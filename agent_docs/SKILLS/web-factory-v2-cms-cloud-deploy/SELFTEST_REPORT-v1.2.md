# v1.2 offline validation — 2026-11-15

- **New permanent repository contract:** 5/5 offline tests PASS via `python -m unittest discover -s tests -p test_permanent_repo.py -q`.
- Disposable Git checkout installation tested: four deliverables present, repo-local runner present, idempotent rerun, conflict refusal. No cloud resources contacted.
- Portable Bash entry points: `bash -n` PASS.
- `scripts/redeploy.py`, `scripts/install-repository-toolchain.py`: Python compile PASS.
- v1.1 legacy self-test full suite: **NOT COMPLETED in this runtime**; execution reached `test_custom_domain_https_is_checked_and_required` and exceeded a bounded timeout while probing an intentionally invalid external HTTPS domain. Claudy previously reported 21/21 for the v1.1 release; **do not claim 21/21 on v1.2 without a complete rerun**.
- Live `./deploy.sh` against Cloud Run: **NOT RUN**, requires Claudy's repository-specific configuration and explicit operator approval.
- Current skill/package can be installed and tested offline; **field certification remains pending the first real repeat public deployment**.
