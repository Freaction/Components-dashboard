@echo off
echo 🧹 Cleaning up old Rust and Node processes...
taskkill /F /IM api-rust.exe 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr LISTENING ^| findstr :3002') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr LISTENING ^| findstr :3001') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr LISTENING ^| findstr :3000') do taskkill /F /PID %%a 2>nul
echo 🚀 Starting RUST API, WEB, and TOKENS PARSER...
npx concurrently -n "RUST,WEB,PARSER" -c "magenta,cyan,yellow" "cargo run --release --manifest-path apps/api-rust/Cargo.toml" "npm run dev --workspace=web" "npm run start --workspace=tokens-parser"
