#!/usr/bin/env bash
#
# Intel Quick Sync Video Benchmark
# https://github.com/ironicbadger/quicksync_calc
#
# Environment variables:
#   QUICKSYNC_NO_SUBMIT=1  - Skip uploading results for web verification
#   QUICKSYNC_ID           - Optional identifier for your submissions
#   QUICKSYNC_API_URL      - API endpoint (default: https://quicksync-api.ktz.me)
#
# Flags:
#   --skip-warnings        - Skip the GPU process warning prompt
#

# Parse command line arguments
SKIP_WARNINGS=0
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-warnings)
      SKIP_WARNINGS=1
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--skip-warnings]"
      exit 1
      ;;
  esac
done

# Configuration
API_URL="${QUICKSYNC_API_URL:-https://quicksync-api.ktz.me}"

start(){

  show_banner

  show_gpu_warning

  cleanup

  dep_check

  check_test_files

  start_container

}

show_banner(){
  cat << 'EOF'
   ___        _      _     ____
  / _ \ _   _(_) ___| | __/ ___| _   _ _ __   ___
 | | | | | | | |/ __| |/ /\___ \| | | | '_ \ / __|
 | |_| | |_| | | (__|   <  ___) | |_| | | | | (__
  \__\_\\__,_|_|\___|_|\_\|____/ \__, |_| |_|\___|
                                 |___/
  Intel Quick Sync Video Benchmark
  https://github.com/ironicbadger/quicksync_calc

EOF

  echo "This script benchmarks Intel Quick Sync Video encoding performance"
  echo "by running FFmpeg transcoding tests inside a Jellyfin container."
  echo ""
  echo "Results can be submitted to the community database for comparison."
  echo "Learn more: https://quicksync.ktz.me"
  echo ""
}

show_gpu_warning(){
  if [ "$SKIP_WARNINGS" -eq 1 ]; then
    return 0
  fi

  echo "======================================================="
  echo "                      WARNING"
  echo "======================================================="
  echo ""
  echo "For accurate benchmark results, please ensure that no"
  echo "other processes are using the Intel GPU, including:"
  echo ""
  echo "  - Jellyfin / Plex / Emby transcoding sessions"
  echo "  - Desktop compositors using hardware acceleration"
  echo "  - Browsers with hardware video decode enabled"
  echo "  - Other FFmpeg or video encoding processes"
  echo ""
  echo "GPU activity during the benchmark will skew power"
  echo "measurements and may affect encoding performance."
  echo ""
  echo "Tip: Run 'intel_gpu_top' in another terminal to check"
  echo "     for GPU activity before proceeding."
  echo ""
  echo "======================================================="
  echo ""
  read -p "Press Enter to continue or Ctrl+C to abort... "
  echo ""
}

dep_check(){

  if ! which jq >/dev/null; then
    echo "jq missing. Please install jq"
    exit 127
  fi

  if ! which intel_gpu_top >/dev/null; then
    echo "intel_gpu_top missing. Please install intel-gpu-tools"
    exit 127
  fi

  if ! which printf >/dev/null; then
    echo "printf missing. Please install printf"
    exit 127
  fi

  if ! which docker >/dev/null; then
    echo "Docker missing. Please install Docker"
    exit 127
  fi

  if ! which curl >/dev/null; then
    echo "curl missing. Please install curl"
    exit 127
  fi

  if ! which awk >/dev/null; then
    echo "awk missing. Please install awk"
    exit 127
  fi

}

# Test video files with their sizes in bytes
TEST_FILES=(
  "ribblehead_1080p_h264.mp4:274139015"
  "ribblehead_4k_h264.mp4:678112692"
  "ribblehead_1080p_hevc_8bit.mp4:216202134"
  "ribblehead_4k_hevc_10bit.mp4:645361807"
)
BASE_URL="https://ssh.us-east-1.linodeobjects.com"

format_size(){
  local bytes=$1
  if [ $bytes -ge 1073741824 ]; then
    echo "$(awk "BEGIN {printf \"%.1f\", $bytes / 1073741824}")GB"
  elif [ $bytes -ge 1048576 ]; then
    echo "$(awk "BEGIN {printf \"%.0f\", $bytes / 1048576}")MB"
  else
    echo "${bytes}B"
  fi
}

check_test_files(){
  local missing_files=()
  local missing_sizes=()
  local total_missing=0

  echo "Checking for test video files..."

  for entry in "${TEST_FILES[@]}"; do
    local filename="${entry%%:*}"
    local size="${entry##*:}"

    if [ ! -f "$filename" ]; then
      missing_files+=("$filename")
      missing_sizes+=("$size")
      total_missing=$((total_missing + size))
    fi
  done

  if [ ${#missing_files[@]} -eq 0 ]; then
    echo "All test files present."
    return 0
  fi

  echo ""
  echo "Missing test video files:"
  echo ""
  for i in "${!missing_files[@]}"; do
    printf "  %-35s %s\n" "${missing_files[$i]}" "$(format_size ${missing_sizes[$i]})"
  done
  echo ""
  echo "  Total download size: $(format_size $total_missing)"
  echo ""
  read -p "Download missing files? (y/n): " confirm

  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Cannot run benchmark without test files. Exiting."
    exit 1
  fi

  echo ""
  download_files "${missing_files[@]}"
}

download_files(){
  local files=("$@")
  local count=1
  local total=${#files[@]}

  for filename in "${files[@]}"; do
    echo "[$count/$total] Downloading $filename"
    # Use curl default progress which shows: % Total  % Received  Speed  Time
    if ! curl -f -L -o "$filename" "${BASE_URL}/${filename}"; then
      echo "  ERROR: Failed to download $filename"
      exit 1
    fi
    count=$((count + 1))
  done

  echo ""
  echo "All files downloaded successfully."
}

cleanup(){
  # Remove any stale test containers
  docker rm -f jellyfin-qsvtest >/dev/null 2>&1 || true

  # Delete any previous report files
  rm -f ffmpeg*.log
  rm -f *.output
}

start_container(){
  local max_attempts=3
  local attempt=1

  # Clean up any existing container first
  if docker inspect jellyfin-qsvtest >/dev/null 2>&1; then
    echo "Removing existing test container..."
    docker rm -f jellyfin-qsvtest >/dev/null 2>&1
  fi

  echo "Pulling Jellyfin container..."
  docker pull docker.io/jellyfin/jellyfin >/dev/null

  while [ $attempt -le $max_attempts ]; do
    echo "Starting Jellyfin QSV test container (attempt $attempt/$max_attempts)..."

    # Clean up in case previous attempt left a container
    docker rm -f jellyfin-qsvtest >/dev/null 2>&1 || true

    # Start container WITHOUT --rm so it persists between tests
    if ! docker run -d --name jellyfin-qsvtest --device=/dev/dri:/dev/dri -v "$(pwd)":/config docker.io/jellyfin/jellyfin >/dev/null 2>&1; then
      echo "  Failed to start container"
      attempt=$((attempt + 1))
      continue
    fi

    # Wait for container to be ready (max 15 seconds)
    local wait_count=0
    while [ $wait_count -lt 15 ]; do
      if docker inspect jellyfin-qsvtest 2>/dev/null | jq -e '.[].State.Running' >/dev/null 2>&1; then
        # Container is running, verify it's responsive
        if docker exec jellyfin-qsvtest echo "ready" >/dev/null 2>&1; then
          echo "  Container ready!"
          main
          return 0
        fi
      fi
      sleep 1
      wait_count=$((wait_count + 1))
    done

    echo "  Container startup timed out"
    docker rm -f jellyfin-qsvtest >/dev/null 2>&1 || true
    attempt=$((attempt + 1))
  done

  echo "ERROR: Failed to start Jellyfin container after $max_attempts attempts"
  echo "Try manually: docker rm -f jellyfin-qsvtest"
  exit 1
}

# Ensure container is running before a benchmark
ensure_container_running(){
  if ! docker inspect jellyfin-qsvtest 2>/dev/null | jq -e '.[].State.Running' >/dev/null 2>&1; then
    echo "  Container stopped, restarting..."
    docker start jellyfin-qsvtest >/dev/null 2>&1 || {
      # Container was removed, recreate it
      docker run -d --name jellyfin-qsvtest --device=/dev/dri:/dev/dri -v "$(pwd)":/config docker.io/jellyfin/jellyfin >/dev/null 2>&1
    }
    sleep 3
  fi
}

stop_container(){
  # Stop and remove the test container
  docker rm -f jellyfin-qsvtest >/dev/null 2>&1 || true
}

benchmarks(){
  # Ensure container is still running before each benchmark
  ensure_container_running

  intel_gpu_top -s 100ms -l -o $1.output &
  igtpid=$(echo $!)
  docker exec jellyfin-qsvtest /config/benchmark.sh $1
  kill -s SIGINT $igtpid

  #Calculate average Wattage
  if [ $1 != "h264_1080p_cpu" ]; then
    total_watts=$(
      awk '{ print $5 }' $1.output \
      | grep -E '^[0-9.]+$' \
      | grep -Ev '^(0(\.0+)?|Power|gpu)$' \
      | awk '{sum += $1} END {print sum}'
    )
    total_count=$(
      awk '{ print $5 }' $1.output \
      | grep -E '^[0-9.]+$' \
      | grep -Ev '^(0(\.0+)?|Power|gpu)$' \
      | wc -l
    )
    avg_watts=$(awk "BEGIN {printf \"%.2f\", $total_watts / $total_count}")

    # Validate power reading
    if [ "$(awk "BEGIN {print ($avg_watts < 3)}")" -eq 1 ]; then
      echo ""
      echo "======================================================="
      echo "           ⚠️  WARNING: LOW POWER READING"
      echo "======================================================="
      echo ""
      echo "Measured power: ${avg_watts}W"
      echo "Expected range: 10-50W for typical encoding workloads"
      echo ""
      echo "This suggests a power measurement issue:"
      echo "  - intel_gpu_top reporting incorrect power domain"
      echo "  - Kernel driver bug (especially on newer CPUs)"
      echo "  - GPU power monitoring not supported"
      echo ""
      echo "Please file an issue with the following details:"
      echo "  https://github.com/ironicbadger/quicksync_calc/issues/new"
      echo ""
      echo "  CPU: $cpu_model"
      echo "  Power reading: ${avg_watts}W"
      echo "  intel_gpu_top: $(intel_gpu_top --version 2>&1 | head -1)"
      echo "  Kernel: $(uname -r)"
      echo ""
      echo "Results will NOT be submitted to prevent data quality issues."
      echo "======================================================="
      echo ""
      avg_watts="REJECTED"
    fi
  else
    avg_watts="N/A"
  fi

  for i in $(ls ffmpeg-*.log); do
    #Calculate average FPS
    total_fps=$(grep -Eo 'fps=.[1-9][1-9].' $i | sed -e 's/fps=//' | awk '{sum += $1} END {print sum}')
    fps_count=$(grep -Eo 'fps=.[1-9][1-9].' $i | wc -l)
    avg_fps=$(awk "BEGIN {printf \"%.2f\", $total_fps / $fps_count}")

    #Calculate average speed
    total_speed=$(grep -Eo 'speed=[0-9]+(\.[0-9]+)?x' "$i" \
      | sed -E 's/speed=([0-9.]+)x/\1/' \
      | awk '{sum += $1} END {print sum}')
    speed_count=$(grep -Eo 'speed=[0-9]+(\.[0-9]+)?x' "$i" | wc -l)
    avg_speed="$(awk "BEGIN {printf \"%.2f\", $total_speed / $speed_count}")x"

    #Get Bitrate of file
    bitrate=$(grep -Eo 'bitrate: [1-9].*' $i | sed -e 's/bitrate: //')

    #Get time to convert
    total_time=$(grep -Eo 'rtime=[0-9]+\.[0-9]+s' $i | sed -e 's/rtime=//')

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

run_benchmark(){
  local current=$1
  local total=$2
  local test_id=$3
  local file_id=$4
  local description=$5
  local expected=$6

  printf "[%d/%d] %-25s (expected: %s)\n" "$current" "$total" "$description" "$expected"

  # Run the actual benchmark
  benchmarks "$test_id" "$file_id"

  printf "       Done!\n"
}

main(){

  #Sets Array
  quicksyncstats_arr=("CPU|TEST|FILE|BITRATE|TIME|AVG_FPS|AVG_SPEED|AVG_WATTS")

  #Collects CPU Model
  cpuinfo_model="$(grep -m1 'model name' /proc/cpuinfo | cut -d':' -f2)"
  cpu_model="${cpuinfo_model:-1}"

  # Check for virtual/emulated CPUs (not supported for benchmarking)
  if echo "$cpu_model" | grep -qiE 'QEMU|Virtual|VMware|VirtualBox|Hyper-V|KVM'; then
    echo ""
    echo "ERROR: Virtual/emulated CPUs are not supported for benchmarking."
    echo "Detected CPU: $cpu_model"
    echo ""
    echo "This benchmark requires real hardware with Intel Quick Sync Video support."
    exit 1
  fi

  echo ""
  echo "Running benchmarks (estimated total time: 5-7 minutes)"
  echo "======================================================="
  echo ""

  run_benchmark 1 5 "h264_1080p_cpu" "ribblehead_1080p_h264" "H.264 1080p (CPU)" "~60-90s"
  run_benchmark 2 5 "h264_1080p" "ribblehead_1080p_h264" "H.264 1080p (QSV)" "~15-20s"
  run_benchmark 3 5 "h264_4k" "ribblehead_4k_h264" "H.264 4K (QSV)" "~60-70s"
  run_benchmark 4 5 "hevc_8bit" "ribblehead_1080p_hevc_8bit" "HEVC 1080p 8-bit (QSV)" "~45-50s"
  run_benchmark 5 5 "hevc_4k_10bit" "ribblehead_4k_hevc_10bit" "HEVC 4K 10-bit (QSV)" "~180s"

  echo ""
  echo "======================================================="
  echo "Results:"
  echo ""

  #Print Results
  printf '%s\n' "${quicksyncstats_arr[@]}" | column -t -s '|'
  printf "\n"

  # Upload results for web verification (default behavior)
  if [ "${QUICKSYNC_NO_SUBMIT}" != "1" ]; then
    upload_for_verification
  fi

  #Unset Array
  unset quicksyncstats_arr

  stop_container

}

upload_for_verification(){
  echo "Uploading results for verification..."

  # Create temp file for submission data
  local tmpfile
  tmpfile=$(mktemp)
  printf '%s\n' "${quicksyncstats_arr[@]}" > "$tmpfile"

  # Upload to pending endpoint
  local response
  response=$(curl -s -X POST \
    -H "Content-Type: text/plain" \
    --data-binary "@${tmpfile}" \
    "${API_URL}/api/submit/pending" 2>/dev/null) || response=""

  rm -f "$tmpfile"

  # Extract token from response
  local token
  token=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$token" ]; then
    # Build submission URL with optional ID
    local submit_url="https://quicksync.ktz.me/submit?token=${token}"
    if [ -n "${QUICKSYNC_ID:-}" ]; then
      # URL-encode the ID (basic encoding for common characters)
      local encoded_id
      encoded_id=$(printf '%s' "$QUICKSYNC_ID" | sed 's/ /%20/g; s/!/%21/g; s/#/%23/g; s/\$/%24/g; s/&/%26/g; s/'\''/%27/g; s/(/%28/g; s/)/%29/g; s/+/%2B/g; s/,/%2C/g; s/:/%3A/g; s/;/%3B/g; s/=/%3D/g; s/?/%3F/g; s/@/%40/g')
      submit_url="${submit_url}&id=${encoded_id}"
    fi

    echo ""
    echo "================================================================"
    echo ""
    echo "  Submit your results at:"
    echo ""
    echo "    ${submit_url}"
    echo ""
    echo "  Link expires in 24 hours."
    echo ""
    echo "================================================================"
  else
    echo ""
    echo "Could not upload results for verification."
    echo "Results displayed above can still be shared manually."
    echo ""
    # Show any error message
    local error_msg
    error_msg=$(echo "$response" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
    if [ -n "$error_msg" ]; then
      echo "Error: $error_msg"
    fi
  fi
}

start
