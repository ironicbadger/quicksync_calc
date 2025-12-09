#!/bin/bash

# Change to config directory first so FFmpeg report files are written there
cd /config

benchmark(){
  case "$1" in
    h264_1080p_cpu)
      h264_1080p_cpu
      ;;
    h264_1080p)
      h264_1080p
      ;;
    h264_4k)
      h264_4k
      ;;
    hevc_8bit)
      hevc_8bit
      ;;
    hevc_4k_10bit)
      hevc_4k_10bit
      ;;
  esac
}

h264_1080p_cpu(){
  /usr/lib/jellyfin-ffmpeg/ffmpeg -y -hide_banner -benchmark -report -c:v h264 -i /config/ribblehead_1080p_h264.mp4 -c:a copy -c:v h264 -preset fast -global_quality 18 -look_ahead 1 -f null - 2>/dev/null
}

h264_1080p(){
  /usr/lib/jellyfin-ffmpeg/ffmpeg -y -hide_banner -benchmark -report -c:v h264 -i /config/ribblehead_1080p_h264.mp4 -c:a copy -c:v h264_qsv -preset fast -global_quality 18 -look_ahead 1 -f null - 2>/dev/null
}

h264_4k(){
  /usr/lib/jellyfin-ffmpeg/ffmpeg -y -hide_banner -benchmark -report -c:v h264 -i /config/ribblehead_4k_h264.mp4 -c:a copy -c:v h264_qsv -preset fast -global_quality 18 -look_ahead 1 -f null - 2>/dev/null
}

hevc_8bit(){
  /usr/lib/jellyfin-ffmpeg/ffmpeg -y -hide_banner -benchmark -report -c:v hevc_qsv -i /config/ribblehead_1080p_hevc_8bit.mp4 -c:a copy -c:v hevc_qsv -preset fast -global_quality 18 -look_ahead 1 -f null - 2>/dev/null
}

hevc_4k_10bit(){
  /usr/lib/jellyfin-ffmpeg/ffmpeg -y -hide_banner -benchmark -report -c:v hevc_qsv -i /config/ribblehead_4k_hevc_10bit.mp4 -c:a copy -c:v hevc_qsv -preset fast -global_quality 18 -look_ahead 1 -f null - 2>/dev/null
}

benchmark $1