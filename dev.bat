@echo off
echo 🧹 Cleaning up old Rust and Node processes...
taskkill /F /IM api-rust.exe 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3002') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a 2>nul
echo 🚀 Starting RUST API and WEB...
npx concurrently -n "RUST,WEB" -c "magenta,cyan" "cargo run --manifest-path apps/api-rust/Cargo.toml" "npm run dev --workspace=web"
