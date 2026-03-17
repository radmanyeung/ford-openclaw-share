# openclaw-tunnel.ps1
# OpenClaw SSH Tunnel — 連接到遠端 VPS 嘅 OpenClaw Gateway
#
# 用法：
#   1. 修改下面嘅設定（VPS IP、SSH key 路徑等）
#   2. 右鍵 → 用 PowerShell 執行，或喺終端機輸入 .\openclaw-tunnel.ps1
#   3. 連接後喺瀏覽器打開 http://127.0.0.1:18789/
#   4. 輸入 Gateway Token 登入
#
# 首次執行如果遇到「無法執行腳本」錯誤，先跑：
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# ============================================================
# 設定（改成你嘅資料）
# ============================================================
$VPS_IP     = "YOUR_VPS_IP"                           # VPS IP 地址
$VPS_USER   = "ubuntu"                                # SSH 用戶名
$SSH_KEY    = "$env:USERPROFILE\.ssh\id_ed25519"      # SSH private key 路徑
$LOCAL_PORT = 18789                                    # 本地 port（瀏覽器用）
$REMOTE_PORT = 18789                                   # VPS 上嘅 OpenClaw Gateway port

# ============================================================
# 連接
# ============================================================
$Host.UI.RawUI.WindowTitle = "OpenClaw Tunnel"

Write-Host ""
Write-Host "  OpenClaw SSH Tunnel" -ForegroundColor Cyan
Write-Host "  ===================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  VPS:    $VPS_USER@$VPS_IP" -ForegroundColor White
Write-Host "  Local:  http://127.0.0.1:$LOCAL_PORT/" -ForegroundColor Green
Write-Host ""
Write-Host "  連接後喺瀏覽器打開上面嘅網址" -ForegroundColor Yellow
Write-Host "  按 Ctrl+C 中斷連接" -ForegroundColor Yellow
Write-Host ""

ssh -N -L "${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}" -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}"

# 如果 SSH 斷開
Write-Host ""
Write-Host "  連接已中斷。" -ForegroundColor Red
Write-Host "  按任意鍵關閉..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
