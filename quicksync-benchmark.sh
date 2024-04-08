#!/bin/bash

get_cpu_model(){
  local cpu_vendor=$(grep -m1 'vendor_id' /proc/cpuinfo | awk '{ print $NF }')
  local cpu_model="Unknown"
  case $cpu_vendor in
    "GenuineIntel")
      if $(grep -m1 'model name' /proc/cpuinfo | grep -E '13th'); then
        cpu_model=$(grep -m1 'model name' /proc/cpuinfo | awk '{ print $NF }')
      else
        cpu_model=$(grep -m1 'model name' /proc/cpuinfo | awk '{ print $6 }')
      fi
      ;;
    "AuthenticAMD")
      if ! grep -m1 'model name' /proc/cpuinfo | grep -qi "radeon"
      then
        echo "AMD CPU without Radeon Graphics detected. Please use a CPU with Radeon Graphics"
        return 1
      fi
      # e.g.: AMD Ryzen 7 PRO 4750U with Radeon Graphics
      cpu_model=$(grep -m1 'model name' /proc/cpuinfo | sed -r -e 's/model name\t: AMD //' -e 's/ with Radeon Graphics//')
      ;;
  esac
  echo "${cpu_model}"
}

get_cpu_vendor(){
  local cpu_vendor=$(grep -m1 'vendor_id' /proc/cpuinfo | awk '{ print $NF }')
  case $cpu_vendor in
    "GenuineIntel")
      cpu_vendor="Intel"
      ;;
    "AuthenticAMD")
      cpu_vendor="AMD"
      ;;
    *)
      cpu_vendor="Unknown"
      ;;
  esac
  echo "${cpu_vendor}"
}

detect_cpu(){
  cpu_vendor=$(get_cpu_vendor)
  cpu_model=$(get_cpu_model)
  # return code of get_cpu_model is 1 if CPU is not supported
  return $?
}

start(){

  if ! detect_cpu
  then
    echo "Error: ${cpu_model}" >&2
    exit 127
  fi

  cleanup

  dep_check

  start_container

}

dep_check(){

  case $cpu_vendor in
    "Intel")
      if ! which intel_gpu_top >/dev/null; then
        echo "intel_gpu_top missing. Please install intel-gpu-tools"
        exit 127
      fi
      ;;
    "AMD")
      if ! which amdgpu_top >/dev/null; then
        echo "amdgpu_top missing. Please install amdgpu-top from https://github.com/Umio-Yasuno/amdgpu_top"
        exit 127
      fi
      ;;
  esac


  if ! which printf >/dev/null; then
    echo "printf missing. Please install printf"
    exit 127
  fi

  if ! which docker >/dev/null; then
    echo "Docker missing. Please install Docker"
    exit 127
  fi

}

cleanup(){
  #Delete any previous report file
  rm -rf ffmpeg*.log
  rm -rf *.output
}

start_container(){

  if ! $(docker inspect jellyfin >/dev/null 2>&1); then
    docker pull jellyfin/jellyfin >/dev/null
    docker run --rm -it -d --name jellyfin-qsvtest --device=/dev/dri:/dev/dri -v $(pwd):/config jellyfin/jellyfin >/dev/null
  fi

  sleep 5s

  if $(docker inspect jellyfin-qsvtest | jq -r '.[].State.Running'); then
    main
  else
    echo "Jellyfin QSV test container not running"
    exit 127
  fi

}

stop_container(){

  if $(docker inspect jellyfin-qsvtest | jq -r '.[].State.Running'); then
    docker stop jellyfin-qsvtest > /dev/null
    docker rmi jellyfin/jellyfin > /dev/null
  fi

}

benchmarks(){

  if [ $cpu_vendor == 'Intel' ]; then
    intel_gpu_top -s 100ms -l -o $1.output &
    igtpid=$(echo $!)
  elif [ $cpu_vendor == 'AMD' ]; then
    amdgpu_top -u 1 --json > $1.output &
    igtpid=$(echo $!)
  fi
  docker exec -it jellyfin-qsvtest /config/benchmark.sh "$cpu_vendor" $1
  kill -s SIGINT $igtpid

  #Calculate average Wattage
  if [ $1 != "h264_1080p_cpu" ]; then
    if [ $cpu_vendor == 'Intel' ]; then
      total_watts=$(awk '{ print $5 }' $1.output | grep -Ev '^0|Power|gpu' | paste -s -d + - | bc)
      total_count=$(awk '{ print $5 }' $1.output | grep -Ev '^0|Power|gpu' | wc -l)
      avg_watts=$(echo "scale=2; $total_watts / $total_count" | bc -l)
    elif [ $cpu_vendor == 'AMD' ]; then
      total_watts=$(cat $1.output | jq -c -r '(.Sensors."GFX Power".value)' | paste -s -d + - | bc)
      total_count=$(cat $1.output | jq -c -r '(.Sensors."GFX Power".value)' | wc -l)
      avg_watts=$(echo "scale=2; $total_watts / $total_count" | bc -l)
    fi
  else
    avg_watts="N/A"
  fi

  for i in $(ls ffmpeg-*.log); do
    #Calculate average FPS
    total_fps=$(grep -Eo 'fps=.[1-9][1-9].' $i | sed -e 's/fps=//' | paste -s -d + - | bc)
    fps_count=$(grep -Eo 'fps=.[1-9][1-9].' $i | wc -l)
    avg_fps=$(echo "scale=2; $total_fps / $fps_count" | bc -l)

    #Calculate average speed
    total_speed=$(grep -Eo 'speed=[0-9].[0-9].' $i | sed -e 's/speed=//' | paste -s -d + - | bc)
    speed_count=$(grep -Eo 'speed=[0-9].[0-9].' $i | sed -e 's/speed=//' | wc -l)
    avg_speed="$(echo "scale=2; $total_speed / $speed_count" | bc -l)x"

    #Get Bitrate of file
    bitrate=$(grep -Eo 'bitrate: [1-9].*' $i | sed -e 's/bitrate: //')

    #Get time to convert
    total_time=$(grep -Eo 'rtime=[1-9].*s' $i | sed -e 's/rtime=//')

    #delete log file
    rm -rf $i
    rm -rf $1.output
  done

  #Add data to array
  quicksyncstats_arr+=("$cpu_model|$1|$2|$bitrate|$total_time|$avg_fps|$avg_speed|$avg_watts")

  clear_vars

}

clear_vars(){

 for i in total_watts total_count avg_watts total_fps fps_count avg_fps total_speed speed_count avg_speed bitrate total_time; do
   unset $i
 done

}

main(){

  #Sets Array
  quicksyncstats_arr=("CPU|TEST|FILE|BITRATE|TIME|AVG_FPS|AVG_SPEED|AVG_WATTS")

  benchmarks h264_1080p_cpu ribblehead_1080p_h264

  benchmarks h264_1080p ribblehead_1080p_h264

  benchmarks h264_4k ribblehead_4k_h264

  benchmarks hevc_8bit ribblehead_1080p_hevc_8bit

  benchmarks hevc_4k_10bit ribblehead_4k_hevc_10bit

  #Print Results
  printf '%s\n' "${quicksyncstats_arr[@]}" | column -t -s '|'
  printf "\n"

  #Unset Array
  unset quicksyncstats_arr

  stop_container

}

start
