@echo off
setlocal

if "%~1"=="-vV" (
  echo rustc 1.98.0 (797e8a9bc 2026-08-05)
  echo binary: rustc
  echo commit-hash: 797e8a9bc
  echo commit-date: 2026-08-05
  echo host: x86_64-pc-windows-msvc
  echo release: 1.98.0
  echo LLVM version: 20.1.8
  exit /b 0
)

"%RUSTC_REAL_PATH%" %*
exit /b %errorlevel%
