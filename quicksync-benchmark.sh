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
#   --concurrency          - Run concurrency tests (how many simultaneous streams)
#

# Parse command line arguments
SKIP_WARNINGS=0
RUN_CONCURRENCY=0
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-warnings)
      SKIP_WARNINGS=1
      shift
      ;;
    --concurrency)
      RUN_CONCURRENCY=1
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--skip-warnings] [--concurrency]"
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

  if ! which bc >/dev/null; then
    echo "bc missing. Please install bc"
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
    echo "$(echo "scale=1; $bytes / 1073741824" | bc)GB"
  elif [ $bytes -ge 1048576 ]; then
    echo "$(echo "scale=0; $bytes / 1048576" | bc)MB"
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
      | paste -s -d+ - \
      | bc
    )
    total_count=$(
      awk '{ print $5 }' $1.output \
      | grep -E '^[0-9.]+$' \
      | grep -Ev '^(0(\.0+)?|Power|gpu)$' \
      | wc -l
    )
    avg_watts=$(echo "scale=2; $total_watts / $total_count" | bc -l)

    # Validate power reading
    if [ "$(echo "$avg_watts < 3" | bc -l)" -eq 1 ]; then
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
    total_fps=$(grep -Eo 'fps=.[1-9][1-9].' $i | sed -e 's/fps=//' | paste -s -d + - | bc)
    fps_count=$(grep -Eo 'fps=.[1-9][1-9].' $i | wc -l)
    avg_fps=$(echo "scale=2; $total_fps / $fps_count" | bc -l)

    #Calculate average speed
    total_speed=$(grep -Eo 'speed=[0-9]+(\.[0-9]+)?x' "$i" \
      | sed -E 's/speed=([0-9.]+)x/\1/' \
      | paste -s -d+ - \
      | bc)
    speed_count=$(grep -Eo 'speed=[0-9]+(\.[0-9]+)?x' "$i" | wc -l)
    avg_speed="$(echo "scale=2; $total_speed / $speed_count" | bc -l)x"

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

# ============================================================
# Codec Detection (for experimental VP9/AV1 tests)
# ============================================================

# Check if a QSV encoder is available
# Usage: check_qsv_encoder encoder_name
# Returns: 0 if available, 1 if not
check_qsv_encoder(){
  local encoder=$1

  # Try to initialize the encoder with a quick test
  # This uses ffmpeg's -f lavfi input to avoid needing a file
  docker exec jellyfin-qsvtest /usr/lib/jellyfin-ffmpeg/ffmpeg \
    -hide_banner -v quiet \
    -f lavfi -i "nullsrc=s=64x64:d=0.1" \
    -c:v "$encoder" \
    -frames:v 1 \
    -f null - 2>/dev/null

  return $?
}

# Detect available QSV codecs
detect_qsv_codecs(){
  echo "Detecting available QSV encoders..."

  VP9_SUPPORTED=0
  AV1_SUPPORTED=0

  if check_qsv_encoder "vp9_qsv"; then
    VP9_SUPPORTED=1
    echo "  VP9 QSV: supported"
  else
    echo "  VP9 QSV: not available"
  fi

  if check_qsv_encoder "av1_qsv"; then
    AV1_SUPPORTED=1
    echo "  AV1 QSV: supported"
  else
    echo "  AV1 QSV: not available"
  fi

  echo ""
}

# ============================================================
# Concurrency Testing
# ============================================================

# Run N concurrent encodes and measure average speed
# Usage: run_concurrent_test test_id concurrency
# Returns: average speed across all streams (or 0 if failed)
run_concurrent_test(){
  local test_id=$1
  local concurrency=$2
  local tmpdir=$(mktemp -d)
  local pids=()

  # Ensure container is running
  ensure_container_running

  # Clean up any old log files
  rm -f ffmpeg-*.log 2>/dev/null

  # Start N concurrent encodes in background
  for i in $(seq 1 $concurrency); do
    docker exec jellyfin-qsvtest /config/benchmark.sh "$test_id" 2>/dev/null &
    pids+=($!)
  done

  # Wait for all encodes to complete
  for pid in "${pids[@]}"; do
    wait "$pid" 2>/dev/null
  done

  # Parse all log files and compute average speed
  local total_speed=0
  local count=0

  for logfile in ffmpeg-*.log; do
    if [ -f "$logfile" ]; then
      # Get the final speed value from the log
      local speed=$(grep -Eo 'speed=[0-9]+(\.[0-9]+)?x' "$logfile" | tail -1 | sed -E 's/speed=([0-9.]+)x/\1/')
      if [ -n "$speed" ] && [ "$(echo "$speed > 0" | bc -l 2>/dev/null)" = "1" ]; then
        total_speed=$(echo "$total_speed + $speed" | bc -l)
        count=$((count + 1))
      fi
      rm -f "$logfile"
    fi
  done

  # Clean up
  rm -rf "$tmpdir"

  if [ "$count" -eq 0 ]; then
    echo "0"
  else
    # Return average speed
    echo "scale=2; $total_speed / $count" | bc -l
  fi
}

# Find maximum concurrency for a test (where speed stays >= 1.0x)
# Usage: find_max_concurrency test_id test_file max_level
# Sets: concurrency_speeds array and concurrency_max variable
find_max_concurrency(){
  local test_id=$1
  local test_file=$2
  local max_level=${3:-10}

  concurrency_speeds=()
  concurrency_max=0

  for level in $(seq 1 $max_level); do
    printf "  Testing %dx concurrent..." "$level"

    local speed=$(run_concurrent_test "$test_id" "$level")

    if [ -z "$speed" ] || [ "$speed" = "0" ]; then
      printf " failed\n"
      concurrency_speeds+=("-")
      break
    fi

    printf " %sx\n" "$speed"
    concurrency_speeds+=("${speed}x")

    # Track max concurrency where speed >= 1.0
    if [ "$(echo "$speed >= 1.0" | bc -l)" -eq 1 ]; then
      concurrency_max=$level
    else
      # Stop testing once we drop below 1.0x
      break
    fi
  done
}

# Run all concurrency tests
run_concurrency_tests(){
  echo ""
  echo "======================================================="
  echo "Concurrency Testing"
  echo "======================================================="
  echo ""
  echo "Testing maximum simultaneous streams while maintaining"
  echo "realtime (>=1.0x) encoding speed..."
  echo ""

  # Initialize concurrency results array with header
  concurrency_arr=("CPU|TEST|FILE|1x|2x|3x|4x|5x|6x|7x|8x|9x|10x")

  # Test H.264 1080p concurrency
  echo "[1/2] H.264 1080p concurrency test"
  find_max_concurrency "h264_1080p" "ribblehead_1080p_h264" 10

  # Build result line using global arrays set by find_max_concurrency
  local h264_line="$cpu_model|h264_1080p|ribblehead_1080p_h264"
  for speed in "${concurrency_speeds[@]}"; do
    h264_line="$h264_line|$speed"
  done
  concurrency_arr+=("$h264_line")
  echo "  Max concurrent H.264 1080p: ${concurrency_max}x"
  echo ""

  # Test HEVC 1080p concurrency
  echo "[2/2] HEVC 1080p concurrency test"
  find_max_concurrency "hevc_8bit" "ribblehead_1080p_hevc_8bit" 10

  # Build result line using global arrays set by find_max_concurrency
  local hevc_line="$cpu_model|hevc_8bit|ribblehead_1080p_hevc_8bit"
  for speed in "${concurrency_speeds[@]}"; do
    hevc_line="$hevc_line|$speed"
  done
  concurrency_arr+=("$hevc_line")
  echo "  Max concurrent HEVC 1080p: ${concurrency_max}x"
  echo ""

  echo "======================================================="
  echo "Concurrency Results:"
  echo ""
  printf '%s\n' "${concurrency_arr[@]}" | column -t -s '|'
  echo ""

  # Upload concurrency results
  if [ "${QUICKSYNC_NO_SUBMIT}" != "1" ]; then
    upload_concurrency_results
  fi
}

upload_concurrency_results(){
  echo "Uploading concurrency results..."

  # Create temp file for submission data
  local tmpfile
  tmpfile=$(mktemp)
  printf '%s\n' "${concurrency_arr[@]}" > "$tmpfile"

  # Upload to concurrency endpoint
  local response
  local submit_url="${API_URL}/api/submit-concurrency"

  if [ -n "${QUICKSYNC_ID:-}" ]; then
    submit_url="${submit_url}?submitter_id=${QUICKSYNC_ID}"
  fi

  response=$(curl -s -X POST \
    -H "Content-Type: text/plain" \
    --data-binary "@${tmpfile}" \
    "$submit_url" 2>/dev/null) || response=""

  rm -f "$tmpfile"

  # Check response
  local success
  success=$(echo "$response" | grep -o '"success":true')

  if [ -n "$success" ]; then
    local inserted
    inserted=$(echo "$response" | sed -n 's/.*"inserted":\([0-9]*\).*/\1/p')
    echo "  Uploaded ${inserted:-0} concurrency result(s)"
  else
    local error_msg
    error_msg=$(echo "$response" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
    if [ -n "$error_msg" ]; then
      echo "  Upload failed: $error_msg"
    else
      echo "  Upload failed (no response from server)"
    fi
  fi
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
  echo "Core Results:"
  echo ""

  #Print Core Results
  printf '%s\n' "${quicksyncstats_arr[@]}" | column -t -s '|'
  printf "\n"

  # Detect and run experimental codec tests (VP9/AV1)
  echo "======================================================="
  echo "Experimental Codec Tests"
  echo "======================================================="
  echo ""

  detect_qsv_codecs

  local experimental_count=0

  if [ "$VP9_SUPPORTED" -eq 1 ]; then
    experimental_count=$((experimental_count + 1))
    echo "[Experimental] VP9 1080p (QSV)"
    benchmarks "vp9_1080p" "ribblehead_1080p_h264"
    printf "       Done!\n"
  fi

  if [ "$AV1_SUPPORTED" -eq 1 ]; then
    experimental_count=$((experimental_count + 1))
    echo "[Experimental] AV1 1080p (QSV)"
    benchmarks "av1_1080p" "ribblehead_1080p_h264"
    printf "       Done!\n"
  fi

  if [ "$experimental_count" -eq 0 ]; then
    echo "No experimental codecs available on this hardware."
  else
    echo ""
    echo "Experimental Results:"
    echo ""
    # Print last N results (the experimental ones)
    printf '%s\n' "${quicksyncstats_arr[@]}" | tail -$((experimental_count + 1)) | column -t -s '|'
  fi

  echo ""
  echo "======================================================="
  echo "All Results:"
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

  # Run concurrency tests if --concurrency flag was passed
  if [ "$RUN_CONCURRENCY" -eq 1 ]; then
    run_concurrency_tests
  fi

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
