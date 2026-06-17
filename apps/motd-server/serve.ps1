<#
  serve.ps1 - Servidor HTTP estatico minimo para el MOTD del torneo TTT.

  Por que TcpListener y no HttpListener:
    HttpListener exige una reserva de URL-ACL (netsh http add urlacl) o correr
    como administrador para escuchar en algo que no sea localhost. Eso rompe la
    regla de portabilidad (tocar estado del sistema / pedir admin). TcpListener
    abre el socket directo: escucha en 0.0.0.0 sin permisos especiales, sin
    instalar nada, sin tocar el registro. Implementamos HTTP/1.0 a mano; solo
    servimos un par de archivos estaticos, asi que alcanza de sobra.

  Escucha en TODAS las interfaces (0.0.0.0), por eso responde igual en la IP de
  la LAN fisica (192.168.x) que en la de Tailscale (100.x) al mismo tiempo.

  Uso:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 27080] [-Root .\web]
#>
param(
  [int]$Port = 27080,
  [string]$Root = ""
)

$ErrorActionPreference = "Stop"

# Raiz web por defecto = .\web junto a este script (ruta relativa, portable).
if ([string]::IsNullOrWhiteSpace($Root)) {
  $Root = Join-Path $PSScriptRoot "web"
}
$Root = (Resolve-Path $Root).Path

$mime = @{
  ".html" = "text/html; charset=utf-8";
  ".htm"  = "text/html; charset=utf-8";
  ".css"  = "text/css; charset=utf-8";
  ".js"   = "application/javascript";
  ".png"  = "image/png";
  ".jpg"  = "image/jpeg";
  ".jpeg" = "image/jpeg";
  ".gif"  = "image/gif";
  ".ico"  = "image/x-icon";
  ".svg"  = "image/svg+xml";
}

function Send-Response {
  param($Stream, [int]$Code, [string]$Status, [byte[]]$Body, [string]$ContentType)
  $header  = "HTTP/1.0 $Code $Status`r`n"
  $header += "Content-Type: $ContentType`r`n"
  $header += "Content-Length: $($Body.Length)`r`n"
  $header += "Cache-Control: no-cache`r`n"
  $header += "Connection: close`r`n`r`n"
  $hb = [Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($hb, 0, $hb.Length)
  if ($Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
  $Stream.Flush()
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
try {
  $listener.Start()
} catch [System.Net.Sockets.SocketException] {
  Write-Host ""
  Write-Host "  ===========================================================" -ForegroundColor Red
  Write-Host ("   No pude abrir el puerto {0}: ya esta en uso." -f $Port)   -ForegroundColor Yellow
  Write-Host "   Probablemente ya hay un servidor MOTD corriendo (no abras"  -ForegroundColor Gray
  Write-Host "   el .bat dos veces). Si esa ventana sigue abierta, usala."   -ForegroundColor Gray
  Write-Host ("   Para ver quien lo ocupa:  netstat -ano ^| findstr :{0}" -f $Port) -ForegroundColor DarkGray
  Write-Host "  ===========================================================" -ForegroundColor Red
  Write-Host ""
  exit 1
}

Write-Host ""
Write-Host "  ===========================================================" -ForegroundColor DarkYellow
Write-Host "   Servidor MOTD TTT escuchando en el puerto $Port (0.0.0.0)" -ForegroundColor Yellow
Write-Host "   Raiz web: $Root" -ForegroundColor Gray
Write-Host "   (responde tanto en la IP LAN como en la de Tailscale)"      -ForegroundColor Gray
Write-Host "   Ctrl-C para detener."                                       -ForegroundColor DarkGray
Write-Host "  ===========================================================" -ForegroundColor DarkYellow
Write-Host ""

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 4000
      $client.SendTimeout    = 8000
      # Linger: al cerrar, espera a vaciar el buffer de salida y manda FIN (no RST).
      $client.LingerState = New-Object System.Net.Sockets.LingerOption($true, 2)
      $stream = $client.GetStream()

      # --- Leer el request HTTP COMPLETO hasta la linea en blanco (fin de headers) ---
      # Hay que drenar todos los headers: si cerramos el socket con datos del cliente
      # sin leer, Windows manda un RST y el cliente ve "conexion interrumpida".
      $reqLine = $null
      $lineSb = New-Object System.Text.StringBuilder
      $buf = New-Object byte[] 1
      $lineCount = 0
      while ($true) {
        $n = $stream.Read($buf, 0, 1)
        if ($n -le 0) { break }
        $c = $buf[0]
        if ($c -eq 10) {                         # LF -> fin de una linea
          $line = $lineSb.ToString()
          [void]$lineSb.Clear()
          if ($null -eq $reqLine) { $reqLine = $line }
          if ($line -eq "") { break }            # linea en blanco -> fin de headers
          $lineCount++
          if ($lineCount -gt 100) { break }      # tope defensivo
        } elseif ($c -ne 13) {                   # ignorar CR
          if ($lineSb.Length -lt 4096) { [void]$lineSb.Append([char]$c) }
        }
      }
      if ($null -eq $reqLine) { $reqLine = "" }

      $path = "/"
      $parts = $reqLine -split "\s+"
      if ($parts.Count -ge 2 -and $parts[0] -eq "GET") { $path = $parts[1] }

      # Quitar querystring y normalizar
      $path = ($path -split "\?")[0]
      if ($path -eq "/" -or $path -eq "") { $path = "/index.html" }
      try { $path = [Uri]::UnescapeDataString($path) } catch {}

      # --- Resolver archivo dentro de la raiz (anti path-traversal) ---
      $rel = $path.TrimStart("/").Replace("/", "\")
      $full = [IO.Path]::GetFullPath((Join-Path $Root $rel))

      $stamp = (Get-Date).ToString("HH:mm:ss")
      if (-not $full.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $full -PathType Leaf)) {
        $body = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
        Send-Response $stream 404 "Not Found" $body "text/plain; charset=utf-8"
        Write-Host "  [$stamp] 404 $path" -ForegroundColor DarkRed
      } else {
        $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
        $ct  = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
        $body = [IO.File]::ReadAllBytes($full)
        Send-Response $stream 200 "OK" $body $ct
        Write-Host "  [$stamp] 200 $path  ($($body.Length) b)" -ForegroundColor DarkGreen
      }
    } catch {
      # Un cliente que corta la conexion no debe tumbar el server.
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
