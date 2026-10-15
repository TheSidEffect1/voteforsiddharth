
import mimetypes
import os
import re

from django.contrib.staticfiles import finders
from django.http import HttpResponse, StreamingHttpResponse
from django.shortcuts import render


def home(request):
    return render(request, "campaign/index.html")


def campaign_video(request):
    if request.method not in ("GET", "HEAD"):
        response = HttpResponse(status=405)
        response["Allow"] = "GET, HEAD"
        return response

    video_path = finders.find("campaign/videos/mu20-reel.mp4")

    if not video_path or not os.path.isfile(video_path):
        return HttpResponse("Campaign video not found.", status=404)

    file_size = os.path.getsize(video_path)
    content_type = (
        mimetypes.guess_type(video_path)[0] or "video/mp4"
    )

    range_header = request.headers.get("Range")
    start = 0
    end = file_size - 1
    status_code = 200

    if range_header:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())

        if not match or "," in range_header or file_size == 0:
            response = HttpResponse(status=416)
            response["Content-Range"] = f"bytes */{file_size}"
            response["Accept-Ranges"] = "bytes"
            return response

        first, last = match.groups()

        if not first and not last:
            response = HttpResponse(status=416)
            response["Content-Range"] = f"bytes */{file_size}"
            response["Accept-Ranges"] = "bytes"
            return response

        if not first:
            suffix_length = int(last)

            if suffix_length <= 0:
                response = HttpResponse(status=416)
                response["Content-Range"] = f"bytes */{file_size}"
                response["Accept-Ranges"] = "bytes"
                return response

            start = max(0, file_size - suffix_length)
        else:
            start = int(first)

            if start >= file_size:
                response = HttpResponse(status=416)
                response["Content-Range"] = f"bytes */{file_size}"
                response["Accept-Ranges"] = "bytes"
                return response

            if last:
                end = min(int(last), file_size - 1)

                if end < start:
                    response = HttpResponse(status=416)
                    response["Content-Range"] = f"bytes */{file_size}"
                    response["Accept-Ranges"] = "bytes"
                    return response

        status_code = 206

    content_length = end - start + 1

    def file_iterator(path, offset, length):
        with open(path, "rb") as video_file:
            video_file.seek(offset)
            remaining = length

            while remaining > 0:
                chunk = video_file.read(min(64 * 1024, remaining))

                if not chunk:
                    break

                remaining -= len(chunk)
                yield chunk

    if request.method == "HEAD":
        response = HttpResponse(status=status_code)
    else:
        response = StreamingHttpResponse(
            file_iterator(video_path, start, content_length),
            status=status_code,
            content_type=content_type,
        )

    response["Accept-Ranges"] = "bytes"
    response["Content-Length"] = str(content_length)

    if status_code == 206:
        response["Content-Range"] = (
            f"bytes {start}-{end}/{file_size}"
        )

    return response
