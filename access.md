Open the UI at:

- Standard dashboard: http://localhost:8080
- Resident portal: http://localhost:8080/resident

Run simulated telemetry after services are running:

```powershell
docker compose exec backend node scripts/simulate-hardware.js `
  --nodes=6 --readings=18 --interval=300 `
  --invalid-every=7 --signal-loss-every=5
```

The simulator uses MQTT over TLS and the simulated SMS provider.

> With an existing PostgreSQL volume, ensure migrations `016_admin_control_center.sql` and `017_enforce_roles.sql` have been applied. They run automatically only when the database is initialized from empty storage.

# Administrator

## Authentication

Administrators use the standard username/password login form. The backend verifies the password with bcrypt and issues a JWT valid for two hours.

There is no role switcher. To change roles, log out and log in with another account.

## Create an administrator account

The source database seed contains an `admin` row, but its password is a placeholder and cannot be used:

`004_create_users.sql`

Create or reset a usable administrator account:

```powershell
docker compose exec backend node scripts/bootstrap-admin.js `
  my_admin MyStrongPass123! admin
```

This command creates or resets the account. It does not print or recover an existing password.

## Login steps

1. Open http://localhost:8080.
2. Enter the administrator username and password.
3. Click `LOGIN`.
4. The application opens the standard Dashboard.
5. Click `Control Center` in the Administration section of the sidebar.

## Successful view

You should see:

- Administrator Dashboard
- Control Center navigation item
- System health
- Sensor-node counts
- Alert counts
- SMS delivery data
- Grid equipment
- Audit activity
- Performance metrics

The Control Center tabs include:

- Overview
- Sensors & Data
- Communications
- Alerting
- Grid Map
- System & Access

Administrator actions include threshold changes, node enable/disable, subscriber management, grid status overrides, inspections, cutoff recommendations, account management, and audit review.

## Common issues

- `JWT_SECRET` must be configured in `.env`.
- The database, MQTT broker, and backend must be running before login.
- If Control Center reports a missing `system_settings` table, apply migrations `016` and `017` to the existing database.
- Administrator cutoff recommendation is available through `Grid Monitor` and the Control Center.
- Physical transformer switching is not implemented; cutoff is a recommendation only.
- The seeded `admin` password is not usable until reset with `bootstrap-admin.js`.

# Operator

## Authentication

Operators also use the standard username/password form and receive a JWT. Operators do not use the resident portal.

## Create an operator account

Create or reset one with:

```powershell
docker compose exec backend node scripts/bootstrap-admin.js `
  my_operator MyStrongPass123! operator
```

The script name is historical; it creates both administrator and operator accounts.

## Login steps

1. Open http://localhost:8080.
2. Enter the operator username and password.
3. Click `LOGIN`.
4. The application opens the standard Dashboard.

There is no automatic redirect to a separate operator URL.

## Successful view

You should see:

- Dashboard
- Map
- Alerts
- Grid Monitor
- Reports
- Audit Logs
- Profile

Operators do not see the Administrator Control Center or Node administration navigation.

The Grid Monitor should show:

- Live grid equipment
- Cutoff recommendations
- `Recommend cutoff`
- `Inspect`

Operators can acknowledge, resolve, or suppress alerts with a reason. Threshold values are visible through the alert view but threshold editing is Administrator-only.

## Common issues

- Operators require an assigned zone for scoped WebSocket telemetry. Without one, the backend may not deliver scoped operator events.
- Reports are visible in navigation, but some report/export endpoints remain Administrator-only and may return `403`.
- The `Restore` action is intentionally unavailable because physical restoration is not implemented.
- If the simulator has stopped, nodes may appear stale or offline.
- JWTs expire after two hours; log in again when expired.

# Resident

## Authentication

Residents now use an authenticated username/password account. The old phone-only lookup is not the supported flow.

The resident username must equal the registered phone number because the backend uses the authenticated username to locate the subscriber record.

The resident account must also have an active subscriber entry linked to a node.

## Create a resident account

There is no resident account in the source `004_create_users.sql` seed. An Administrator must create one.

First create or reset an administrator:

```powershell
docker compose exec backend node scripts/bootstrap-admin.js `
  my_admin MyStrongPass123! admin
```

Get an Administrator token:

```powershell
$adminToken = (Invoke-RestMethod `
  http://localhost:3000/login `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"username":"my_admin","password":"MyStrongPass123!"}').token
```

Create the resident account through the Administrator API:

```powershell
$headers = @{
  Authorization = "Bearer $adminToken"
  "Content-Type" = "application/json"
}

$body = @{
  username = "+2348000000001"
  password = "ResidentPass123!"
  role = "resident"
  phone = "+2348000000001"
  node_id = "NODE001"
} | ConvertTo-Json

Invoke-RestMethod `
  http://localhost:3000/users `
  -Method Post `
  -Headers $headers `
  -Body $body
```

The backend creates both:

- A resident JWT account in `users`
- A resident notification subscription in `subscribers`

The `node_id` must refer to an existing node.

## Login steps

1. Open http://localhost:8080/resident.
2. Enter the resident phone number as the username.
3. Enter the resident account password.
4. Click `LOGIN`.
5. The page reloads at `/resident` and displays the resident portal.

Do not use the standard `/` route for the resident experience unless you specifically want the general dashboard login page.

## Successful view

You should see:

- `FMS Resident Portal`
- Greeting using the resident name
- Only the node linked to the resident subscription
- Current water level and status
- Safety message
- Recent warning/critical alerts
- Map showing the linked node
- `Sign out`

Residents do not see administrative controls, grid controls, audit logs, raw system metrics, or other residents’ node data.

## Common issues

- A resident account without an active subscriber record receives an error such as “No registered address found.”
- The username must exactly match the subscriber phone.
- The resident portal requires the `/resident` URL.
- A resident JWT cannot access `/alerts`, `/grid`, Control Center, or other operator/admin APIs.
- Live WebSocket events are server-scoped to the resident’s subscribed node.
- The phone-only endpoint is no longer valid; `/resident/status` requires the resident JWT.

# Switching Roles

There is no in-session role switcher.

To test another role:

1. Click `Logout`.
2. Clear any stale browser session if necessary:

```javascript
localStorage.removeItem("jwt");
localStorage.removeItem("role");
```

3. Return to either:
   - http://localhost:8080 for Administrator or Operator
   - http://localhost:8080/resident for Resident
4. Log in with the appropriate account.

A successful role check is visible in the header and sidebar:

- Administrator: `admin` plus `Control Center`
- Operator: `operator`, without `Control Center`
- Resident: `FMS Resident Portal` with only subscribed-node data