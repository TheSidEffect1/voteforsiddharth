document.addEventListener("DOMContentLoaded", function () {
  const sKey = document.getElementById("s-key");
  const portraitSide = document.getElementById("portrait-side");
  const reelStage = document.getElementById("reel-stage");

  const timelineOverlay = document.getElementById("timeline-overlay");
  const timelineScroll = document.getElementById("timeline-scroll");
  const timelineImage = document.getElementById("timeline-image");
  const timelineCanvas = document.getElementById("timeline-canvas");
  const timelinePlayhead = document.getElementById("timeline-playhead");
  const timelineHandHint = document.getElementById("timeline-hand-hint");

  const transitionOverlay = document.getElementById("transition-overlay");
  const portraitTagText = document.getElementById("portrait-tag-text");
  const campaignVideo = document.getElementById("campaign-video");
  const videoPlayButton = document.getElementById("video-play-button");

  const hackathonArrowButton = document.getElementById(
    "hackathon-arrow-button",
  );

  const nextSection = document.getElementById("next-section");

  document.documentElement.classList.add("campaign-scroll-locked");
  document.body.classList.add("campaign-scroll-locked");

  if (
    !sKey ||
    !portraitSide ||
    !reelStage ||
    !timelineOverlay ||
    !timelineScroll ||
    !timelineImage ||
    !timelineCanvas ||
    !timelinePlayhead ||
    !transitionOverlay ||
    !campaignVideo
  ) {
    console.error("Campaign setup error: required elements are missing.");
    return;
  }

  const START_TIME = 9.3;

  let transitioning = false;
  let opened = false;
  let videoStartRequested = false;
  let isDraggingPlayhead = false;
  let initialSeekCompleted = false;
  let hasStartedVideo = false;
  let animationFrameId = null;
  let pageScrollUnlocked = false;

  function hideTimelineHandHint() {
    if (timelineHandHint) {
      timelineHandHint.classList.add("is-hidden");
    }
  }

  function getVideoDuration() {
    return Number.isFinite(campaignVideo.duration) && campaignVideo.duration > 0
      ? campaignVideo.duration
      : 22;
  }

  function timeToPercent(time) {
    return Math.max(0, Math.min(100, (time / getVideoDuration()) * 100));
  }

  function percentToTime(percent) {
    return (Math.max(0, Math.min(100, percent)) / 100) * getVideoDuration();
  }

  function setPlayheadPosition(time) {
    timelinePlayhead.style.left = timeToPercent(time) + "%";
    timelinePlayhead.dataset.time = String(time);

    timelinePlayhead.setAttribute(
      "aria-label",
      "Playhead at " + time.toFixed(1) + " seconds",
    );
  }

  function updatePlayheadVisual(time) {
    timelinePlayhead.style.left = timeToPercent(time) + "%";
  }

  function animatePlayhead() {
    if (!opened || isDraggingPlayhead) {
      animationFrameId = null;
      return;
    }

    updatePlayheadVisual(campaignVideo.currentTime);
    animationFrameId = requestAnimationFrame(animatePlayhead);
  }

  function startPlayheadAnimation() {
    if (animationFrameId !== null) return;
    animationFrameId = requestAnimationFrame(animatePlayhead);
  }

  function stopPlayheadAnimation() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function positionTimelineAtBottom() {
    timelineScroll.scrollTop =
      timelineScroll.scrollHeight - timelineScroll.clientHeight;
  }

  function seekVideo(time) {
    const safeTime = Math.max(0, Math.min(time, getVideoDuration()));

    setPlayheadPosition(safeTime);

    if (campaignVideo.readyState >= 1) {
      try {
        campaignVideo.currentTime = safeTime;
      } catch (error) {
        console.error("Could not seek video:", error);
      }
    }
  }

  function updateVideoButton() {
    if (!videoPlayButton) return;

    const isPlaying = !campaignVideo.paused && !campaignVideo.ended;

    videoPlayButton.classList.toggle("is-playing", isPlaying);
    videoPlayButton.classList.toggle("is-hidden", isPlaying);

    videoPlayButton.setAttribute(
      "aria-label",
      isPlaying ? "Pause video" : "Play video",
    );

    videoPlayButton.setAttribute("aria-pressed", String(isPlaying));
  }

  // Reveal the play button temporarily when the pointer moves over the video.
  let buttonHideTimer;

  if (reelStage && videoPlayButton) {
    reelStage.addEventListener("pointermove", function () {
      if (campaignVideo.paused || campaignVideo.ended) return;

      videoPlayButton.classList.add("is-hover-revealed");
      clearTimeout(buttonHideTimer);

      buttonHideTimer = setTimeout(function () {
        videoPlayButton.classList.remove("is-hover-revealed");
      }, 1800);
    });

    reelStage.addEventListener("pointerleave", function () {
      clearTimeout(buttonHideTimer);
      videoPlayButton.classList.remove("is-hover-revealed");
    });
  }

  async function startVideoForFirstTime() {
    if (hasStartedVideo || !initialSeekCompleted) return;

    try {
      await campaignVideo.play();
      hasStartedVideo = true;
      updateVideoButton();

      console.log("Video playback started:", campaignVideo.currentTime);
    } catch (error) {
      console.error("Video playback failed:", error.name, error.message);

      updateVideoButton();
    }
  }

  // Central play/pause button.
  if (videoPlayButton) {
    videoPlayButton.addEventListener("click", async function (event) {
      event.preventDefault();
      event.stopPropagation();

      if (!hasStartedVideo) {
        await startVideoForFirstTime();
        return;
      }

      if (campaignVideo.paused || campaignVideo.ended) {
        if (campaignVideo.ended) {
          seekVideo(0);
        }

        try {
          await campaignVideo.play();
        } catch (error) {
          console.error("Could not resume video:", error);
        }
      } else {
        campaignVideo.pause();
      }

      updateVideoButton();
    });
  }

  campaignVideo.addEventListener("play", function () {
    hasStartedVideo = true;
    updateVideoButton();
  });

  campaignVideo.addEventListener("playing", updateVideoButton);
  campaignVideo.addEventListener("pause", updateVideoButton);
  campaignVideo.addEventListener("ended", updateVideoButton);

  function startCampaignVideo() {
    if (videoStartRequested) return;

    videoStartRequested = true;

    campaignVideo.controls = false;
    campaignVideo.removeAttribute("controls");
    campaignVideo.muted = false;
    campaignVideo.playsInline = true;
    campaignVideo.preload = "auto";
    campaignVideo.loop = true;

    campaignVideo.style.visibility = "hidden";

    if (videoPlayButton) {
      videoPlayButton.classList.add("is-hidden");
    }

    function seekToStartTime() {
      if (initialSeekCompleted || campaignVideo.readyState < 1) {
        return;
      }

      if (
        !Number.isFinite(campaignVideo.duration) ||
        campaignVideo.duration <= START_TIME
      ) {
        console.error(
          "Cannot seek to starting time. Duration:",
          campaignVideo.duration,
        );

        campaignVideo.style.visibility = "visible";
        return;
      }

      function onSeeked() {
        const actualTime = campaignVideo.currentTime;

        if (Math.abs(actualTime - START_TIME) > 0.5) {
          console.warn("The video has not reached the starting time yet.");
          return;
        }

        campaignVideo.removeEventListener("seeked", onSeeked);

        initialSeekCompleted = true;
        campaignVideo.pause();

        setPlayheadPosition(actualTime);

        campaignVideo.style.visibility = "visible";
        campaignVideo.classList.remove("video-visible");

        void campaignVideo.offsetWidth;

        requestAnimationFrame(function () {
          campaignVideo.classList.add("video-visible");

          if (videoPlayButton && !hasStartedVideo) {
            videoPlayButton.classList.remove("is-hidden");
            updateVideoButton();
          }
        });

        console.log("Initial video position confirmed:", actualTime);
      }

      campaignVideo.addEventListener("seeked", onSeeked);

      try {
        campaignVideo.currentTime = START_TIME;

        if (Math.abs(campaignVideo.currentTime - START_TIME) < 0.05) {
          onSeeked();
        }
      } catch (error) {
        campaignVideo.removeEventListener("seeked", onSeeked);
        campaignVideo.style.visibility = "visible";

        console.error("Could not seek to starting time:", error);
      }
    }

    campaignVideo.addEventListener("loadedmetadata", seekToStartTime, {
      once: true,
    });

    campaignVideo.addEventListener(
      "error",
      function () {
        console.error(
          "Video loading error:",
          campaignVideo.error ? campaignVideo.error.message : "Unknown error",
        );

        campaignVideo.style.visibility = "visible";
      },
      { once: true },
    );

    if (campaignVideo.readyState >= 1) {
      seekToStartTime();
    }

    console.log("Video source:", campaignVideo.currentSrc);
  }

  function revealTimeline() {
    if (transitioning || opened) return;

    transitioning = true;
    opened = true;

    if (hackathonArrowButton) {
      window.setTimeout(function () {
        hackathonArrowButton.classList.add("is-visible");
        hackathonArrowButton.setAttribute("aria-hidden", "false");
        hackathonArrowButton.removeAttribute("tabindex");
      }, 100);
    }

    sKey.classList.add("is-pressed");
    sKey.setAttribute("aria-expanded", "true");

    document.body.classList.add("reel-mode");

    transitionOverlay.classList.remove("run");
    void transitionOverlay.offsetWidth;
    transitionOverlay.classList.add("run");

    startCampaignVideo();

    window.setTimeout(function () {
      reelStage.classList.add("is-active");
      reelStage.setAttribute("aria-hidden", "false");
      reelStage.removeAttribute("inert");

      if (portraitTagText) {
        portraitTagText.textContent = "THE WORK BEHIND IT";
      }

      window.setTimeout(function () {
        timelineOverlay.classList.add("is-active");
        timelineOverlay.setAttribute("aria-hidden", "false");
        timelineOverlay.removeAttribute("inert");

        setPlayheadPosition(
          initialSeekCompleted ? campaignVideo.currentTime : START_TIME,
        );

        requestAnimationFrame(function () {
          requestAnimationFrame(positionTimelineAtBottom);
        });

        startPlayheadAnimation();

        transitioning = false;
        sKey.classList.remove("is-pressed");
      }, 180);
    }, 300);
  }

  function movePlayheadFromPointer(event) {
    const bounds = timelineCanvas.getBoundingClientRect();
    if (!bounds.width) return;

    const percent = ((event.clientX - bounds.left) / bounds.width) * 100;

    seekVideo(percentToTime(percent));
  }

  timelinePlayhead.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    hideTimelineHandHint();

    isDraggingPlayhead = true;
    stopPlayheadAnimation();

    timelinePlayhead.classList.add("is-dragging");
    timelinePlayhead.setPointerCapture(event.pointerId);

    movePlayheadFromPointer(event);
  });

  timelinePlayhead.addEventListener("pointermove", function (event) {
    if (isDraggingPlayhead) {
      movePlayheadFromPointer(event);
    }
  });

  function stopDragging() {
    if (!isDraggingPlayhead) return;

    isDraggingPlayhead = false;
    timelinePlayhead.classList.remove("is-dragging");

    setPlayheadPosition(campaignVideo.currentTime);
    startPlayheadAnimation();
  }

  timelinePlayhead.addEventListener("pointerup", stopDragging);
  timelinePlayhead.addEventListener("pointercancel", stopDragging);
  timelinePlayhead.addEventListener("lostpointercapture", stopDragging);

  campaignVideo.addEventListener("timeupdate", function () {
    if (!isDraggingPlayhead) {
      timelinePlayhead.dataset.time = String(campaignVideo.currentTime);

      timelinePlayhead.setAttribute(
        "aria-label",
        "Playhead at " + campaignVideo.currentTime.toFixed(1) + " seconds",
      );
    }
  });

  campaignVideo.addEventListener("seeked", function () {
    if (!isDraggingPlayhead) {
      setPlayheadPosition(campaignVideo.currentTime);
    }
  });

  timelineCanvas.addEventListener("click", function (event) {
    if (
      event.target === timelinePlayhead ||
      timelinePlayhead.contains(event.target)
    ) {
      return;
    }

    const bounds = timelineCanvas.getBoundingClientRect();
    if (!bounds.width) return;

    hideTimelineHandHint();

    const percent = ((event.clientX - bounds.left) / bounds.width) * 100;

    seekVideo(percentToTime(percent));
  });

  sKey.addEventListener("click", revealTimeline);

  // Down arrow: pause the video and scroll to the next section.
  if (hackathonArrowButton && nextSection) {
    hackathonArrowButton.addEventListener("click", function () {
      if (campaignVideo && !campaignVideo.paused) {
        campaignVideo.pause();
      }

      if (hackathonArrowButton.classList.contains("is-used")) {
        return;
      }

      hackathonArrowButton.classList.add("is-used");
      hackathonArrowButton.disabled = true;

      timelineOverlay.classList.remove("is-active");
      timelineOverlay.setAttribute("aria-hidden", "true");
      timelineOverlay.setAttribute("inert", "");

      hackathonArrowButton.classList.remove("is-visible");
      hackathonArrowButton.setAttribute("aria-hidden", "true");
      hackathonArrowButton.setAttribute("tabindex", "-1");

      pageScrollUnlocked = true;

      document.documentElement.classList.remove("campaign-scroll-locked");

      document.body.classList.remove("campaign-scroll-locked");

      nextSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  window.addEventListener(
    "wheel",
    function (event) {
      if (pageScrollUnlocked) return;

      if (event.target.closest && event.target.closest("#timeline-scroll")) {
        return;
      }

      event.preventDefault();
    },
    { passive: false },
  );

  window.addEventListener(
    "touchmove",
    function (event) {
      if (pageScrollUnlocked) return;

      if (event.target.closest && event.target.closest("#timeline-scroll")) {
        return;
      }

      event.preventDefault();
    },
    { passive: false },
  );

  window.addEventListener(
    "keydown",
    function (event) {
      if (pageScrollUnlocked) return;

      const scrollKeys = [
        "ArrowDown",
        "ArrowUp",
        "PageDown",
        "PageUp",
        "Home",
        "End",
      ];

      if (!scrollKeys.includes(event.key)) return;

      const target = event.target;

      if (target.closest && target.closest("#timeline-scroll")) {
        return;
      }

      event.preventDefault();
    },
    { passive: false },
  );

  document.addEventListener("keydown", function (event) {
    const target = event.target;

    const typing =
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

    if (typing || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if ((event.code === "Space" || event.key === " ") && opened) {
      event.preventDefault();

      if (!hasStartedVideo) {
        startVideoForFirstTime();
        return;
      }

      if (campaignVideo.paused || campaignVideo.ended) {
        if (campaignVideo.ended) {
          seekVideo(0);
        }

        campaignVideo.play().catch(function (error) {
          console.error("Could not resume video:", error.name, error.message);
        });
      } else {
        campaignVideo.pause();
      }

      return;
    }

    if (event.key.toLowerCase() === "s" && !event.repeat) {
      event.preventDefault();
      revealTimeline();
    }
  });

  timelineImage.addEventListener("load", function () {
    if (opened) {
      setPlayheadPosition(campaignVideo.currentTime);
      positionTimelineAtBottom();
    }
  });

  window.addEventListener("resize", function () {
    if (opened) {
      setPlayheadPosition(campaignVideo.currentTime);
      positionTimelineAtBottom();
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopPlayheadAnimation();
    } else if (opened && !isDraggingPlayhead) {
      startPlayheadAnimation();
    }
  });

  setPlayheadPosition(START_TIME);
});

/* =========================================
   HORIZONTAL SCROLL HINT
   ========================================= */

document.addEventListener("DOMContentLoaded", function () {
  const arrow = document.getElementById("horizontal-scroll-hint");
  const nextSection = document.getElementById("next-section");

  if (!arrow || !nextSection) return;

  const observer = new IntersectionObserver(
    function (entries) {
      const entry = entries[0];

      if (entry.isIntersecting) {
        arrow.classList.remove("is-visible");
      } else if (
        window.scrollY + window.innerHeight >=
        nextSection.offsetTop + nextSection.offsetHeight - 10
      ) {
        arrow.classList.add("is-visible");
      } else {
        arrow.classList.remove("is-visible");
      }
    },
    { threshold: 0 },
  );

  observer.observe(nextSection);
});

/* =========================================
   MU20 WRAPPED 2026
   ========================================= */

document.addEventListener("DOMContentLoaded", function () {
  const wrapped = document.getElementById("mu20-wrapped");
  const wrappedPhone = document.getElementById("wrapped-phone");
  const wrappedStory = document.getElementById("wrapped-story");
  const wrappedProgress = document.getElementById("wrapped-progress");
  const wrappedClose = document.getElementById("wrapped-close");
  const wrappedStart = document.getElementById("wrapped-start");
  const wrappedArrow = document.getElementById("horizontal-scroll-hint");

  if (
    !wrapped ||
    !wrappedPhone ||
    !wrappedStory ||
    !wrappedProgress ||
    !wrappedClose
  ) {
    return;
  }

  const stories = [
    {
      eyebrow: "THE LOVE WAS REAL",
      title: "65.7%",
      text: "1,741 of the page's 2,651 total likes came from my reels. Roughly two-thirds of all likes.",
    },
    {
      eyebrow: "THE REACH",
      title: "75K views. 150K total.",
      text: "My reels achieved 75,000 views, helping take total views across the page to 150,000.",
    },
    {
      eyebrow: "THE LEADERBOARD",
      title: "#1 MOST LIKED. #2 MOST VIEWED.",
      text: "Made the page's most-liked reel and its second-most-viewed reel.",
    },
    {
      eyebrow: "SONG OF THE YEAR",
      title: "WE. ON GO.",
      text: "THE SOUNDTRACK OF MU20.",
      type: "song",
    },

    {
      eyebrow: "ALBUM COVER OF THE YEAR",
      title: "SIDDHARTH. FOR. S.G.",
      text: "MU20 2026. THE CAMPAIGN COVER.",
    },

    {
      eyebrow: "YOUR TOP CANDIDATE",
      title: "SIDDHARTH FOR S.G.",
      text: "MU20 WRAPPED 2026. THE NEXT CHAPTER STARTS NOW.",
      type: "final",
    },
  ];

  let currentStory = 0;
  let storyAnimating = false;

  // Audio file: campaign/static/campaign/audio/we-on-go.m4a
  const wrappedSong = new Audio("/static/campaign/audio/we-on-go.m4a");

  wrappedSong.preload = "auto";
  wrappedSong.volume = 0;

  let songFadeFrame = null;

  function stopWrappedSong() {
    if (songFadeFrame !== null) {
      cancelAnimationFrame(songFadeFrame);
      songFadeFrame = null;
    }

    wrappedSong.pause();

    try {
      wrappedSong.currentTime = 0;
    } catch (error) {
      // Metadata may not have loaded yet.
    }

    wrappedSong.volume = 0;
  }

  function playWrappedSong() {
    stopWrappedSong();
    wrappedSong.volume = 0;

    wrappedSong
      .play()
      .then(function () {
        const fadeStart = performance.now();
        const fadeDuration = 1000;
        const targetVolume = 0.08;

        function fadeIn(now) {
          if (
            wrappedSong.paused ||
            currentStory !== 3 ||
            !wrapped.classList.contains("is-open")
          ) {
            songFadeFrame = null;
            return;
          }

          const progress = Math.min((now - fadeStart) / fadeDuration, 1);

          wrappedSong.volume = targetVolume * progress;

          if (progress < 1) {
            songFadeFrame = requestAnimationFrame(fadeIn);
          } else {
            songFadeFrame = null;
          }
        }

        songFadeFrame = requestAnimationFrame(fadeIn);
      })
      .catch(function (error) {
        console.warn("Song playback could not start:", error);
      });
  }

  function renderStory(index) {
    const story = stories[index];

    // Update the active story number and progress bar.
    wrappedPhone.dataset.story = String(index + 1);

    wrappedProgress.style.width = ((index + 1) / stories.length) * 100 + "%";

    // STORY 4 — SONG OF THE YEAR
    if (index === 3) {
      wrappedStory.innerHTML = `
      <span class="story-number">
        04 / ${String(stories.length).padStart(2, "0")}
      </span>

      <span class="song-label">MU20 WRAPPED PRESENTS</span>

      <div class="song-artwork">
        <img
          src="/static/campaign/images/we-on-go.png"
          alt="We On Go song artwork"
        />
      </div>

      <div class="song-caption">
        <span class="song-eyebrow">SONG OF THE YEAR</span>
        <h2>WE. ON GO.</h2>
        <p>THE SOUNDTRACK OF MU20.</p>
      </div>

      <span class="story-tap">TAP TO CONTINUE ↗</span>
    `;

      // Start the song with the existing one-second fade-in.
      // Do not restart it if it is already playing.
      if (wrappedSong.paused && !wrappedSong.ended) {
        playWrappedSong();
      } else if (wrappedSong.ended) {
        wrappedSong.currentTime = 0;
        playWrappedSong();
      }
    }

    // STORY 5 — ALBUM COVER OF THE YEAR
    else if (index === 4) {
      // Keep the song playing while displaying the album cover.
      wrappedStory.innerHTML = `
      <span class="story-number">
        05 / ${String(stories.length).padStart(2, "0")}
      </span>

      <span class="song-label">MU20 WRAPPED PRESENTS</span>

      <div class="song-artwork album-artwork">
        <img
          src="/static/campaign/images/mu20-album-cover.png"
          alt="Siddharth for Secretary General — MU20 2026 campaign cover"
        />
      </div>

      <div class="song-caption">
        <span class="song-eyebrow">ALBUM COVER OF THE YEAR</span>
        <h2>SIDDHARTH. FOR. S.G.</h2>
        <p>MU20 2026 · THE CAMPAIGN COVER</p>
      </div>

      <span class="story-tap">TAP TO CONTINUE ↗</span>
    `;
    }

    // STORY 6 — FINAL CAMPAIGN REVEAL
    else if (index === 5) {
      // Keep the song playing until the audio naturally ends.
      wrappedStory.innerHTML = `
      <span class="story-number">06 / 06</span>

      <div class="final-artwork">
        <img
          src="/static/campaign/images/mu20-wrapped-final.jfif"
          alt="MU20 Wrapped 2026 — Siddharth for Secretary General"
        />
      </div>

      <div class="final-caption">
        <span class="final-eyebrow">YOUR TOP CANDIDATE</span>
        <h2>THE NEXT CHAPTER STARTS NOW.</h2>
      </div>

      <span class="story-tap">TAP TO REPLAY ↻</span>
    `;
    }

    // STORIES 1–3 AND ANY ADDITIONAL STORIES
    else {
      // Do not stop the song when navigating through other stories.
      wrappedStory.innerHTML = `
      <span class="story-number">
        ${String(index + 1).padStart(2, "0")} /
        ${String(stories.length).padStart(2, "0")}
      </span>

      <span class="story-eyebrow">${story.eyebrow}</span>

      <h2>${story.title}</h2>

      <p>${story.text}</p>

      <span class="story-tap">
        ${
          index === stories.length - 1 ? "TAP TO REPLAY ↻" : "TAP TO CONTINUE ↗"
        }
      </span>
    `;
    }

    // Restart the entrance animation for every new story.
    wrappedStory.style.animation = "none";
    void wrappedStory.offsetWidth;
    wrappedStory.style.animation = "";
  }

  function openWrapped() {
    currentStory = 0;
    renderStory(currentStory);

    wrapped.classList.add("is-open");
    wrapped.setAttribute("aria-hidden", "false");
    wrapped.removeAttribute("inert");

    document.body.classList.add("wrapped-open");
  }

  function closeWrapped() {
    stopWrappedSong();

    wrapped.classList.remove("is-open");
    wrapped.setAttribute("aria-hidden", "true");
    wrapped.setAttribute("inert", "");

    document.body.classList.remove("wrapped-open");
  }

  function nextStory() {
    if (storyAnimating || !wrapped.classList.contains("is-open")) {
      return;
    }

    storyAnimating = true;

    currentStory = (currentStory + 1) % stories.length;
    renderStory(currentStory);

    window.setTimeout(function () {
      storyAnimating = false;
    }, 450);
  }

  if (wrappedArrow) {
    wrappedArrow.addEventListener("click", function (event) {
      event.preventDefault();
      openWrapped();
    });

    wrappedArrow.setAttribute("aria-label", "Open MU20 Wrapped 2026");

    wrappedArrow.setAttribute("title", "Open MU20 Wrapped 2026");
  }

  if (wrappedStart) {
    wrappedStart.addEventListener("click", function () {
      currentStory = 0;
      renderStory(currentStory);
    });
  }

  wrappedPhone.addEventListener("click", nextStory);

  wrappedPhone.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      nextStory();
    }
  });

  wrappedClose.addEventListener("click", closeWrapped);

  document.addEventListener("keydown", function (event) {
    if (!wrapped.classList.contains("is-open")) return;

    if (event.key === "Escape") {
      closeWrapped();
    }

    if (event.key === "ArrowRight") {
      nextStory();
    }

    if (event.key === "ArrowLeft") {
      currentStory = (currentStory - 1 + stories.length) % stories.length;

      renderStory(currentStory);
    }
  });

  renderStory(currentStory);
});
