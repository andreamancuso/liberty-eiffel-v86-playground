# All compiler and runtime stages are built with --platform linux/386.
ARG DEBIAN_IMAGE=debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc
FROM ${DEBIAN_IMAGE} AS builder
ARG LIBERTY_REV=21b081378ec12798080128e7f39878d5d2097cb7
RUN test "$(dpkg --print-architecture)" = i386 \
    && apt-get update && apt-get install -y --no-install-recommends \
       build-essential autoconf automake curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/liberty
RUN curl -fsSL --retry 3 "https://codeload.github.com/LibertyEiffel/Liberty/tar.gz/${LIBERTY_REV}" \
    | tar -xz --strip-components=1 \
    && printf '%s\n' "$LIBERTY_REV" > SOURCE_REVISION
# No optional BDW GC: the installer builds the compiler itself with -no_gc.
RUN ./install.sh -plain -bootstrap > /tmp/liberty-build.log 2>&1 \
    || { tail -150 /tmp/liberty-build.log; exit 1; }
RUN mkdir -p /runtime/opt/liberty/target/bin /runtime/opt/liberty/target/liberty-eiffel \
    /runtime/opt/liberty/src /runtime/opt/liberty/resources \
    && cp -L target/bin/se target/bin/compile target/bin/compile_to_c /runtime/opt/liberty/target/bin/ \
    && strip /runtime/opt/liberty/target/bin/* \
    && cp -a sys src/lib /runtime/opt/liberty/ \
    && cp -a resources/short /runtime/opt/liberty/resources/ \
    && mv /runtime/opt/liberty/lib /runtime/opt/liberty/src/lib \
    && cp COPYING AUTHORS SOURCE_REVISION /runtime/opt/liberty/ \
    && sed -E '/^(liberty_extra|liberty_staging|test|smarteiffel|tools|tutorial|ace_check|class_check|clean|doc|find|make|mock|pretty|test_ng|test_server|wrap|x_int):/d; /^short: short$/d; s/^jobs:.*/jobs: 1/; s/^c_compiler_options: -O1 /c_compiler_options: -O0 /' \
       target/liberty-eiffel/liberty.se > /runtime/opt/liberty/target/liberty-eiffel/liberty.se

FROM ${DEBIAN_IMAGE} AS runtime
RUN test "$(dpkg --print-architecture)" = i386 \
    && apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev \
    && rm -rf /var/lib/apt/lists/* /usr/share/man /usr/share/info \
    && useradd -m -u 1000 -s /bin/bash playground \
    && mkdir -p /home/playground/.config /work \
    && chown playground:playground /work
COPY --from=builder /runtime/ /
RUN ln -s /opt/liberty/target/liberty-eiffel /home/playground/.config/liberty-eiffel \
    && chown -R playground:playground /home/playground
ENV PATH="/opt/liberty/target/bin:/usr/local/bin:/usr/bin:/bin" \
    HOME=/home/playground USER=playground LANG=C.UTF-8 LC_ALL=C
WORKDIR /work
USER 1000:1000
CMD ["/bin/bash"]
