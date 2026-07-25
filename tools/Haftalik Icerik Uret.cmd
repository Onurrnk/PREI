@echo off
REM =====================================================================
REM PREI | Haftalik Icerik Paketi — cift tikla calistir.
REM
REM Co-work raporunu bulur, PREI'ye yukler, post metinleri ve karusel
REM gorsellerini uretir, masaustunde tarihli bir klasore yazar.
REM =====================================================================
cd /d "%~dp0"
echo.
node haftalik-icerik.mjs %*
echo.
echo Kapatmak icin bir tusa basin...
pause >nul
