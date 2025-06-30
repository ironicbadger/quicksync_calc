#!/bin/bash

declare -A results
declare -A files
tests=( "h264_1080p_cpu" "h264_1080p" "h264_4k" "hevc_8bit" "hevc_4k_10bit" )

dep_check(){
  for cmd in jq printf docker bc; do
    if ! command -v "$cmd" >/dev/null; then
      echo "$cmd missing. Please install $cmd"
      exit 127
    fi
  done
}

cleanup(){
  rm -rf ffmpeg*.log *.output
}

start_container(){
  if ! docker inspect jellyfin-qsvtest >/dev/null 2>&1; then
    docker pull jellyfin/jellyfin >/dev/null
    docker run --rm -d --name jellyfin-qsvtest \
      --device=/dev/dri:/dev/dri \
      -v "$(pwd)":/config jellyfin/jellyfin >/dev/null
  fi
  sleep 5s
  if ! docker inspect jellyfin-qsvtest | jq -r '.[].State.Running' | grep true >/dev/null; then
    echo "Jellyfin QSV test container not running"
    exit 127
  fi
}

stop_container(){
  if docker inspect jellyfin-qsvtest | jq -r '.[].State.Running' | grep true >/dev/null; then
    docker stop jellyfin-qsvtest >/dev/null
  fi
}

concurrent_benchmarks(){
  local test_type=$1
  local file=$2
  local concurrency=$3
  local pids=()
  for i in $(seq 1 "$concurrency"); do
    docker exec jellyfin-qsvtest /config/benchmark.sh "$test_type" "$file" > /dev/null 2>&1 &
    pids+=($!)
  done
  for pid in "${pids[@]}"; do
    wait "$pid"
  done

  local total_speed=0
  local count=0
  for log in ffmpeg*.log; do
    while IFS= read -r sp; do
      total_speed=$(echo "$total_speed + $sp" | bc -l)
      (( count++ ))
    done < <(grep -Eo 'speed=[[:space:]]*[0-9]+(\.[0-9]+)?' "$log" | sed -E 's/speed=[[:space:]]*//')
    rm -f "$log"
  done

  if [ $count -gt 0 ]; then
    echo $(echo "scale=2; $total_speed / $count" | bc -l)
  else
    echo ""
  fi
}

run_concurrency_test(){
  local test_type=$1
  local file
  case "$test_type" in
    "h264_1080p_cpu") file="ribblehead_1080p_h264" ;;
    "h264_1080p")    file="ribblehead_1080p_h264" ;;
    "h264_4k")       file="ribblehead_4k_h264" ;;
    "hevc_8bit")     file="ribblehead_1080p_hevc_8bit" ;;
    "hevc_4k_10bit") file="ribblehead_4k_hevc_10bit" ;;
    *) echo "Unknown test type: $test_type"; exit 1 ;;
  esac

  files["$test_type"]="$file"

  echo "--------------------------------------------------"
  echo "Starting concurrency test for $test_type..."
  local concurrency=1 last_valid=0 avg_speed=0
  local speeds=()

  while true; do
    cleanup
    echo -n "Concurrency: $concurrency, Running..."
    avg_speed=$(concurrent_benchmarks "$test_type" "$file" "$concurrency")
    echo -e "\rConcurrency: $concurrency, Average Speed: ${avg_speed}x"
    [ -z "$avg_speed" ] && break
    speeds+=("$avg_speed")
    if (( $(echo "$avg_speed < 1.0" | bc -l) )); then
      break
    else
      last_valid=$concurrency
    fi
    ((concurrency++))
  done
  echo "Maximum concurrency: ${last_valid}x"
  results["$test_type"]="${speeds[*]}"
}

run_all_tests(){
  for test in "${tests[@]}"; do
    run_concurrency_test "$test"
  done
}

print_table(){
  local cpu
  cpu=$(grep -m1 'model name' /proc/cpuinfo | cut -d':' -f2 | sed 's/^[[:space:]]*//')

  local max_cols=0
  for test in "${tests[@]}"; do
    read -ra arr <<< "${results[$test]}"
    (( ${#arr[@]} > max_cols )) && max_cols=${#arr[@]}
  done

  local header="CPU|TEST|FILE"
  for ((i=1; i<=max_cols; i++)); do
    header+="|${i}x"
  done
  
  local table=("$header")
  for test in "${tests[@]}"; do
    local file=${files[$test]}
    read -ra arr <<< "${results[$test]}"
    local row="${cpu}|${test}|${file}"
    for ((j=0; j<max_cols; j++)); do
      if [ $j -lt ${#arr[@]} ]; then
        row+="|${arr[j]}x"
      else
        row+="|–"
      fi
    done
    table+=("$row")
  done
  
  printf '%s\n' "${table[@]}" | column -t -s '|'
}

main(){
  dep_check
  cleanup
  start_container
  run_all_tests
  stop_container
  echo ""
  print_table
}

main
