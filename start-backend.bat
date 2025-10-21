@echo off
echo Starting FindLove Backend Server...
echo.
echo Make sure MongoDB is running first!
echo.
echo Installing dependencies...
npm install
echo.
echo Starting server on http://localhost:5000
echo.
echo Keep this window open while using the app
echo.
node server.js
pause
