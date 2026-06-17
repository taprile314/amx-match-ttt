<#
  detect-ip.ps1 - Imprime la "mejor" IPv4 privada de la LAN para usar en el
  MOTD (192.168.x / 10.x / 172.16-31.x). Si no encuentra, no imprime nada.

  A proposito IGNORA el rango 100.x de Tailscale (CGNAT): por defecto preferimos
  la IP de la LAN fisica. Si tu torneo es 100% Tailscale, fija MOTD_HOST a mano
  en start_servidor_ttt.bat con la IP 100.x (o el nombre MagicDNS del host).
#>
$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)' -and
    $_.IPAddress -notmatch '^169\.254\.'
  } |
  Sort-Object InterfaceMetric |
  Select-Object -First 1 -ExpandProperty IPAddress
if ($ip) { [Console]::Out.Write($ip) }
