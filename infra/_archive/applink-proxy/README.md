# Kaththokra — free static IP for Applink (Oracle Cloud Always Free)

```
Vercel (PWA + API)  ──HTTPS + secret──►  Oracle VM (static IP)  ──►  api.applink.com.bd
                                          Caddy (HTTPS) → server.js
Applink callbacks (SMS MO, USSD, CaaS, Subscription) can keep pointing at kaththokra.vercel.app.
```

Files:

| File | What it is |
|---|---|
| `cloud-init.yaml` | Paste into Oracle when creating the VM. Installs and starts everything. |
| `server.js` | The proxy itself (already embedded inside `cloud-init.yaml`; kept here for reference). |
| `applink.ts` | Helper for a Node/Next.js backend on Vercel. |
| `applink_client.py` | Helper for a FastAPI/Python backend. |

---

## 1. Make a secret

Generate a long random string (32+ letters/numbers). Any password generator works, or run `openssl rand -hex 32`.
Open `cloud-init.yaml` and replace `CHANGE_ME_LONG_RANDOM_SECRET` with it. Keep it; Vercel needs the same value.

## 2. Create the Oracle account

1. Go to <https://www.oracle.com/cloud/free/> and click **Start for free**.
2. **Home region: choose `Singapore`.** It is closest to Bangladesh and can't be changed later.
3. Oracle verifies a card. Always Free resources are not charged.

## 3. Create the VM

Menu → **Compute → Instances → Create instance**

- **Name:** `kaththokra-proxy`
- **Image:** Change image → **Canonical Ubuntu 24.04** (the normal one, not "Minimal")
- **Shape:** **VM.Standard.E2.1.Micro** (Always Free). `VM.Standard.A1.Flex` (1 OCPU, 6 GB) also works, but often says "out of capacity".
- **Networking:** create a new VCN and a **public** subnet; keep **Assign a public IPv4 address** on.
- **SSH keys:** **Save private key** and keep the file. You only need it for troubleshooting.
- **Advanced options → Management → Initialization script → Paste cloud-init script:** paste the whole `cloud-init.yaml` (with your secret already in it).
- Click **Create**. Setup takes about 3–5 minutes after the VM shows *Running*.

## 4. Open ports 80 and 443 in Oracle's network

Instance page → click the **Subnet** link → **Security** → **Default Security List** → **Add Ingress Rules**:

- Source CIDR `0.0.0.0/0`, IP protocol **TCP**, Destination port range `80,443` → **Add**

(The VM's own firewall is already opened by the script.)

## 5. Make the IP permanent (reserved IP)

The IP the VM starts with is *ephemeral*. A reserved IP stays yours even if you rebuild the VM.

1. Menu → **Networking → IP management → Reserved public IPs → Reserve public IP address**. Give it a name and reserve it. Note the IP.
2. Instance page → **Networking** (or *Attached VNICs*) → the primary VNIC → **IP addresses**.
3. On the primary private IP: **⋯ → Edit** → Public IP type **No public IP** → **Update** (removes the ephemeral one).
4. **⋯ → Edit** again → **Reserved public IP** → *Select existing* → pick yours → **Update**.
5. Instance page → **Reboot**. Caddy re-detects the IP on boot and gets a free HTTPS certificate for it.

## 6. Check it works

Your proxy URL is the reserved IP with dashes, plus `.sslip.io`. Example: IP `140.245.12.34` → `https://140-245-12-34.sslip.io`

- `https://<ip-with-dashes>.sslip.io/health` → `{"ok":true}`
- `https://<ip-with-dashes>.sslip.io/myip` → must show **your reserved IP**

The first load after a reboot can take up to a minute while the certificate is issued.

## 7. Applink form

**Allowed Host Address(es):** your reserved IP, e.g. `140.245.12.34`

## 8. Vercel environment variables

Project → Settings → Environment Variables, then redeploy:

| Name | Value |
|---|---|
| `APPLINK_PROXY_URL` | `https://<ip-with-dashes>.sslip.io` (no trailing slash) |
| `APPLINK_PROXY_SECRET` | the secret from step 1 |
| `APPLINK_APP_ID` | from Applink, after the app is created |
| `APPLINK_PASSWORD` | from Applink, after the app is created |

Then call Applink only through the helper, e.g. `applink('sms/send', {...})`, never directly from the browser.

---

## Troubleshooting

SSH in: `ssh -i <your-private-key> ubuntu@<reserved-ip>`

```bash
sudo cloud-init status --long          # did the setup script finish?
cat /etc/applink-proxy-url             # proxy URL Caddy is using
systemctl status applink-proxy caddy   # are both running?
journalctl -u applink-proxy -n 50      # proxy log (method, path, Applink statusCode; never bodies)
journalctl -u caddy -n 50              # HTTPS certificate problems show here
```

- **Proxy won't start / log says "PROXY_SECRET is missing":** you didn't replace the placeholder. `sudo nano /etc/applink-proxy.env`, set it, then `sudo systemctl restart applink-proxy`.
- **/health doesn't load:** check step 4 (ports 80 and 443), then `journalctl -u caddy`.
- **IP changed:** `sudo systemctl restart caddy` (or reboot), then update Vercel's `APPLINK_PROXY_URL` and the Applink form.
- **Proxy replies `PROXY_UNAUTHORIZED`:** Vercel's `APPLINK_PROXY_SECRET` doesn't match the VM's.
- **Applink replies E1303:** the request didn't come from the whitelisted IP. Compare `/myip` with the IP in the Applink form.

**Idle reclaim:** Oracle may reclaim Always Free VMs that stay almost completely idle for 7 days, and emails before it does. Keep an eye on that email during the hackathon.
