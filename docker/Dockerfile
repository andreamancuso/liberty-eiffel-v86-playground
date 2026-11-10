ARG TOOLCHAIN_IMAGE=liberty-eiffel-v86:toolchain
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
    && chown 1000:1000 /exchange /work \
    && dpkg-query -W > /opt/proof/v86-packages.tsv

FROM --platform=linux/amd64 mcr.microsoft.com/playwright:v1.56.1-noble AS assets
ARG V86_SOURCE_REV=315b2b0b758703ef0e6cc7b4088d6068f83f3c20
WORKDIR /assets
RUN npm install --no-audit --no-fund --save-exact v86@0.5.473
RUN mkdir /v86-source \
    && curl -fsSL --retry 3 "https://codeload.github.com/copy/v86/tar.gz/${V86_SOURCE_REV}" \
       | tar -xz --strip-components=1 -C /v86-source \
    && printf '%s\n' "$V86_SOURCE_REV" > /v86-source/SOURCE_REVISION

FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc AS packager
RUN apt-get update && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=guest / /rootfs/
COPY --from=assets /v86-source/ /v86-source/
COPY --from=assets /assets/node_modules/v86/ /v86-runtime/
COPY --from=assets /assets/package-lock.json /out/npm-package-lock.json
RUN mkdir -p /out/fs /out/runtime /out/bios /out/licenses \
    && cp /v86-runtime/build/libv86.js /v86-runtime/build/v86*.wasm /out/runtime/ \
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
    && cp /rootfs/opt/proof/v86-packages.tsv /out/ \
    && du -sh /rootfs /out/fs > /out/sizes.txt \
    && cd /out && sha256sum vmlinuz initrd.img fs.json runtime/* bios/* > SHA256SUMS
FROM scratch AS artifacts
COPY --from=packager /out/ /
