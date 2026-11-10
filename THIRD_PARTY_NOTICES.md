# Third-party notices

The root MIT license covers this project's original UI, integration code, examples and documentation. Upstream software downloaded by the Docker build and third-party material visible in the screenshot retain their own license terms.

## v86 and firmware

v86 is Copyright (c) 2012, The v86 contributors, under the BSD 2-Clause license. A copy is retained in [third_party/v86-LICENSE](third_party/v86-LICENSE). The 9p boot configuration and filesystem packaging follow v86's Debian example and documentation.

- [Pinned v86 source and license](https://github.com/copy/v86/tree/315b2b0b758703ef0e6cc7b4088d6068f83f3c20)
- [Debian image example](https://github.com/copy/v86/blob/315b2b0b758703ef0e6cc7b4088d6068f83f3c20/tools/docker/debian/Dockerfile)

The build downloads v86 npm package 0.5.473. Its runtime includes components with separate notices, including Berkeley SoftFloat, Zstandard and MIT-licensed code identified by v86. SeaBIOS firmware has its own license and source; v86's firmware build script records SeaBIOS tag `rel-1.16.2`. The packaging step retains supplied notices/source headers in `artifacts/licenses/`. Those files are useful records, not a complete binary-redistribution compliance package.

## Guest compiler and operating system

- **Liberty Eiffel:** [source at the pinned revision](https://github.com/LibertyEiffel/Liberty/tree/21b081378ec12798080128e7f39878d5d2097cb7), with [GPLv3 COPYING](https://github.com/LibertyEiffel/Liberty/blob/21b081378ec12798080128e7f39878d5d2097cb7/COPYING) and per-file notices for its libraries/runtime. The build retains COPYING and AUTHORS in `/opt/liberty`.
- **Linux:** [kernel licensing rules](https://www.kernel.org/doc/html/latest/process/license-rules.html) describe GPL-2.0-only for the kernel as a whole, the syscall exception and per-file terms.
- **GCC, binutils, glibc and other Debian packages:** these retain their GNU or other upstream licenses and applicable exceptions. For example, [GCC runtime-library terms](https://gcc.gnu.org/onlinedocs/libstdc++/manual/license.html) distinguish runtime-library permissions from compiler licensing. Consult each exact package's `/usr/share/doc/<package>/copyright`, source package and file notices rather than treating all guest software as one license.

The guest preserves Debian package copyright files. `artifacts/v86-packages.tsv` records installed versions; build recipes pin Liberty and the Debian base image. Debian's [source package archive](https://sources.debian.org/) and [snapshot archive](https://snapshot.debian.org/) can help locate matching source versions.

## Build and hosting dependencies

The build uses Debian packages and Python for filesystem packaging. Local hosting uses Nginx, whose container image includes separately licensed dependencies. Each component retains its package notices.

## Before distributing generated images

Serving runtime, firmware or guest filesystem binaries to visitors distributes those components. Retain the applicable copyright and license notices, provide corresponding source/build material where required, and account for relevant library exceptions and modification/relinking requirements. A URL to an upstream project or a version manifest alone is not a substitute for satisfying the applicable distribution terms.

No prebuilt runtime, firmware, container image or filesystem is published by this repository. The initial distribution is this project's source and build recipes.
