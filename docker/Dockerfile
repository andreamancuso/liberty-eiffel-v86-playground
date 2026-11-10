ARG TOOLCHAIN_IMAGE=liberty-eiffel-v86:toolchain
ARG DEBIAN_IMAGE=debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc
FROM ${TOOLCHAIN_IMAGE} AS guest
USER root
ENV DEBIAN_FRONTEND=noninteractive
RUN test "$(dpkg --print-architecture)" = i386 \
    && apt-get update \
    && apt-get install -y --no-install-recommends linux-image-686 initramfs-tools \
    && rm -rf /var/lib/apt/lists/*
ENV PATH=/opt/liberty/target/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
COPY docker/boot-9p /etc/initramfs-tools/scripts/boot-9p
RUN printf '%s\n' 9p 9pnet 9pnet_virtio virtio virtio_ring virtio_pci >> /etc/initramfs-tools/modules \
    && printf '\nBOOT=boot-9p\n' >> /etc/initramfs-tools/initramfs.conf \
    && printf 'RESUME=none\n' > /etc/initramfs-tools/conf.d/resume \
    && chmod 755 /etc/initramfs-tools/scripts/boot-9p \
    && update-initramfs -u -k all
COPY docker/guest-init /usr/local/sbin/playground-init
COPY docker/guest-run /usr/local/bin/v86-run
RUN chmod 755 /usr/local/sbin/playground-init /usr/local/bin/v86-run \
    && mkdir -p /exchange /work /run /proc /sys /dev/pts \
    && chown 1000:1000 /exchange /work

FROM ${DEBIAN_IMAGE} AS packager
ARG V86_VERSION=0.5.473
ARG V86_SHA512=98d1c1d035c399fc67d02ae5a829a580c4755bb68ab83fac1e649cb4b71344e3b0a4ebdb138aac02199a13a572fab8907dc1383df036c6f5b9f7f657b189c737
ARG V86_SOURCE_REV=315b2b0b758703ef0e6cc7b4088d6068f83f3c20
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl python3 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /assets
RUN mkdir /v86-source /v86-runtime \
    && curl -fsSL --retry 3 "https://registry.npmjs.org/v86/-/v86-${V86_VERSION}.tgz" -o "v86-${V86_VERSION}.tgz" \
    && printf '%s  v86-%s.tgz\n' "$V86_SHA512" "$V86_VERSION" > v86-runtime.sha512 \
    && sha512sum -c v86-runtime.sha512 \
    && tar -xzf "v86-${V86_VERSION}.tgz" --strip-components=1 -C /v86-runtime \
    && curl -fsSL --retry 3 "https://codeload.github.com/copy/v86/tar.gz/${V86_SOURCE_REV}" -o v86-source.tgz \
    && tar -xzf v86-source.tgz --strip-components=1 -C /v86-source \
    && printf '%s\n' "$V86_SOURCE_REV" > /v86-source/SOURCE_REVISION \
    && rm "v86-${V86_VERSION}.tgz" v86-source.tgz
COPY --from=guest / /rootfs/
RUN mkdir -p /out/fs /out/runtime /out/bios /out/licenses \
    && cp /v86-runtime/build/libv86.js /v86-runtime/build/v86.wasm /v86-runtime/build/v86-fallback.wasm /out/runtime/ \
    && cp /assets/v86-runtime.sha512 /out/ \
    && cp /v86-source/bios/seabios.bin /v86-source/bios/vgabios.bin /out/bios/ \
    && cp /v86-source/LICENSE /out/licenses/v86-BSD-2-Clause.txt \
    && cp /v86-source/LICENSE.MIT /out/licenses/v86-MIT-components.txt \
    && cp /v86-source/lib/softfloat/softfloat.c /out/licenses/softfloat.c \
    && cp /v86-source/lib/zstd/zstddeclib.c /out/licenses/zstddeclib.c \
    && cp /v86-source/bios/COPYING.LESSER /out/licenses/firmware-COPYING.LESSER \
    && cp /v86-source/SOURCE_REVISION /out/V86_SOURCE_REVISION \
    && cp /rootfs/boot/vmlinuz-* /out/vmlinuz \
    && cp /rootfs/boot/initrd.img-* /out/initrd.img \
    && python3 /v86-source/tools/fs2json.py --out /out/fs.json /rootfs \
    && python3 /v86-source/tools/copy-to-sha256.py /rootfs /out/fs \
    && dpkg-query --admindir=/rootfs/var/lib/dpkg -W > /out/v86-packages.tsv \
    && du -sh /rootfs /out/fs > /out/sizes.txt \
    && cd /out && sha256sum vmlinuz initrd.img fs.json runtime/* bios/* > SHA256SUMS
FROM scratch AS artifacts
COPY --from=packager /out/ /
