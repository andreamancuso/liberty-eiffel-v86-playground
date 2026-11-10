FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /runner
RUN npm install --no-audit --no-fund --save-exact playwright@1.56.1
COPY tests/browser.mjs ./browser.mjs
CMD ["node", "browser.mjs"]
