#!/bin/bash

video_path=/config
cpu_vendor=$(grep -m1 "^vendor_id" /proc/cpuinfo | awk '{print $3}')

case $cpu_vendor in
  AuthenticAMD )
    acceleration="vaapi"
    vaapi_opts="-init_hw_device vaapi=va:/dev/dri/renderD128 -filter_hw_device va -hwaccel vaapi -hwaccel_output_format vaapi"
  ;;

  GenuineIntel )
    acceleration="qsv"
    vaapi_opts=""
  ;;

  *)
    echo "CPU Vendor could not be deteced"
    exit 1
  ;;
esac

ffmpeg(){
  /usr/lib/jellyfin-ffmpeg/ffmpeg -y -hide_banner -benchmark -report "$@" -c:a copy -preset fast -global_quality 18 -look_ahead 1 -f null - 2>/dev/null
}

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
  echo "=== CPU only test"
  echo "h264_1080p_cpu - h264 to h264 cpu starting."
  ffmpeg -c:v h264 -i ${video_path}/ribblehead_1080p_h264.mp4 -c:v h264 
}

h264_1080p(){
  echo "=== ${acceleration^^} test"
  echo "h264_1080p - h264 to h264_${acceleration} starting."
  ffmpeg ${vaapi_opts} -c:v h264 -i ${video_path}/ribblehead_1080p_h264.mp4 -c:v h264_${acceleration} 
}

h264_4k(){
  echo "=== ${acceleration^^} test"
  echo "h264_4k - h264 to h264_${acceleration} starting."
  ffmpeg ${vaapi_opts} -c:v h264 -i ${video_path}/ribblehead_4k_h264.mp4 -c:v h264_${acceleration}
}

hevc_8bit(){
  echo "=== ${acceleration^^} test"
  echo "hevc_1080p_8bit - hevc 8bit to hevc_${acceleration} starting."
  ffmpeg ${vaapi_opts} -i ${video_path}/ribblehead_1080p_hevc_8bit.mp4 -c:v hevc_${acceleration}
}

hevc_4k_10bit(){
  echo "=== ${acceleration^^} test"
  echo "hevc_4k - hevc 10bit to hevc_${acceleration} starting."
  ffmpeg ${vaapi_opts} -i ${video_path}/ribblehead_4k_hevc_10bit.mp4 -c:v hevc_${acceleration}
}

cd /config

benchmark $1