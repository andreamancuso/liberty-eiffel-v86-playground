#!/bin/sh
set -eu
echo "Debian architecture: $(dpkg --print-architecture)"
test "$(dpkg --print-architecture)" = i386
cat /opt/proof/compiler-architecture.txt
gcc --version | head -1
se -version
cp /examples/hello.e /work/hello.e
start=$(date +%s%N)
se c -no_split -all_check -o /work/hello /work/hello.e
end=$(date +%s%N)
echo "Native compile milliseconds: $(( (end - start) / 1000000 ))"
readelf -h /work/hello | head -20
readelf -h /work/hello | grep -q 'Class:.*ELF32'
readelf -h /work/hello | grep -q 'Machine:.*Intel 80386'
output=$(/work/hello)
printf '%s\n' "$output"
test "$output" = 'Hello from Eiffel in your browser!'
cp /examples/error.e /work/hello.e
rm -f /work/hello
if se c -no_split -all_check -o /work/hello /work/hello.e > /work/error.log 2>&1; then
    echo 'ERROR: invalid Eiffel compiled successfully' >&2
    exit 1
fi
cat /work/error.log
grep -q this_feature_does_not_exist /work/error.log
test ! -e /work/hello
rm -f /work/hello* /work/error.log
echo 'PASS: i386 compile/run and intentional compiler error'
