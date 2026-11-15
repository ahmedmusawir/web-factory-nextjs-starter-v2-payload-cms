#!/bin/bash
# QA static checks + independent production build (Node 22.23.5)
export PATH=/tmp/stark-node-runtime/node_modules/.bin:$PATH
Q=evidence/qa-claudy/mission-003/logs
node -v > $Q/node-version.txt; npm -v >> $Q/node-version.txt
npm run typecheck > $Q/typecheck.log 2>&1; echo "typecheck exit=$?" > $Q/static-summary.txt
npm run lint > $Q/lint.log 2>&1; echo "lint exit=$?" >> $Q/static-summary.txt
npm run test:unit > $Q/unit.log 2>&1; echo "unit exit=$?" >> $Q/static-summary.txt
npm run check:generated > $Q/check-generated.log 2>&1; echo "check:generated exit=$?" >> $Q/static-summary.txt
npm audit --json > $Q/audit.json 2> $Q/audit.err; echo "audit exit=$?" >> $Q/static-summary.txt
NEXT_DIST_DIR=.next-qa-claudy npm run build > $Q/build.log 2>&1; echo "build exit=$?" >> $Q/static-summary.txt
