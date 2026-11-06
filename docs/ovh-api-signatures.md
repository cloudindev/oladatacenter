
## schema `vps` (apiVersion 1.0)

### `GET /vps`
List your VPS
- returns: `string[]`
- params:
  - `iamTags`: map[string][]iam.resource.TagFilter [query] (optional) — Filter resources on IAM tags

### `GET /vps/{serviceName}`
Get information about a specific VPS
- returns: `vps.VPSWithIAM`
- params:
  - `serviceName`: string [path] — Service name

### `PUT /vps/{serviceName}`
Edit properties of the given VPS
- returns: `void`
- params:
  - `(body)`: vps.VPS [body] — Request Body
  - `serviceName`: string [path] — Service name

### `GET /vps/{serviceName}/ips`
List IPs attached to this VPS
- returns: `ip[]`
- params:
  - `serviceName`: string [path] — Service name

### `GET /vps/{serviceName}/serviceInfos`
Retrieve the service information for this VPS
- returns: `services.Service`
- params:
  - `serviceName`: string [path] — Service name

### `PUT /vps/{serviceName}/serviceInfos`
Update the service information for this VPS
- returns: `void`
- params:
  - `(body)`: services.Service [body] — Request Body
  - `serviceName`: string [path] — Service name

### `GET /vps/{serviceName}/tasks`
List tasks associated with this VPS
- returns: `long[]`
- params:
  - `serviceName`: string [path] — Service name
  - `state`: vps.TaskStateEnum [query] (optional) — Filter the value of state property (=)
  - `type`: vps.TaskTypeEnum [query] (optional) — Filter the value of type property (=)

### `GET /vps/{serviceName}/tasks/{id}`
Retrieve details about a specific task for this VPS
- returns: `vps.Task`
- params:
  - `id`: long [path] — Id
  - `serviceName`: string [path] — Service name

### `GET /vps/{serviceName}/status`
Retrieve the service status of the main IP for this VPS
- returns: `vps.ip.ServiceStatus`
- params:
  - `serviceName`: string [path] — Service name

### `POST /vps/{serviceName}/start`
Start the VPS (power on) and return an asynchronous task
- returns: `vps.Task`
- params:
  - `serviceName`: string [path] — Service name

### `POST /vps/{serviceName}/stop`
Stop the VPS (power off) and return an asynchronous task
- returns: `vps.Task`
- params:
  - `serviceName`: string [path] — Service name

### `POST /vps/{serviceName}/reboot`
Request a reboot of the VPS
- returns: `vps.Task`
- params:
  - `serviceName`: string [path] — Service name

### `GET /vps/{serviceName}/images/available`
List images available for this VPS
- returns: `string[]`
- params:
  - `serviceName`: string [path] — Service name

### `GET /vps/{serviceName}/images/current`
Retrieve the currently installed image on this VPS
- returns: `vps.Image`
- params:
  - `serviceName`: string [path] — Service name

### `POST /vps/{serviceName}/rebuild`
Rebuild (reinstall) this VPS and return an asynchronous task
- returns: `vps.Task`
- params:
  - `(body)`: vps.rebuild.post [body] — Request Body
  - `serviceName`: string [path] — Service name

### `POST /vps/{serviceName}/getConsoleUrl`
Generate and return a console access URL for this VPS
- returns: `string`
- params:
  - `serviceName`: string [path] — Service name

### `POST /vps/{serviceName}/openConsoleAccess`
Generate the information required to open a VNC connection to this VPS
- returns: `vps.Vnc`
- params:
  - `(body)`: vps.openConsoleAccess.post [body] — Request Body
  - `serviceName`: string [path] — Service name

### `POST /vps/{serviceName}/createSnapshot`
Create a snapshot of this VPS (requires the snapshot option and no existing snapshot); returns an asynchronous task
- returns: `vps.Task`
- params:
  - `(body)`: vps.createSnapshot.post [body] — Request Body
  - `serviceName`: string [path] — Service name

### `GET /vps/{serviceName}/snapshot`
Retrieve information about the current VPS snapshot
- returns: `vps.Snapshot`
- params:
  - `serviceName`: string [path] — Service name

### `DELETE /vps/{serviceName}/snapshot`
Delete the VPS snapshot and return an asynchronous task
- returns: `vps.Task`
- params:
  - `serviceName`: string [path] — Service name

### `POST /vps/{serviceName}/snapshot/revert`
Revert this VPS to the specified snapshot and return an asynchronous task
- returns: `vps.Task`
- params:
  - `serviceName`: string [path] — Service name

### `GET /vps/{serviceName}/automatedBackup`
Retrieve automated backup settings for this VPS
- returns: `vps.AutomatedBackup`
- params:
  - `serviceName`: string [path] — Service name

### `GET /vps/{serviceName}/automatedBackup/restorePoints`
List available restore points for the automated backup
- returns: `datetime[]`
- params:
  - `serviceName`: string [path] — Service name
  - `state`: vps.RestoreStateEnum [query] — The state of the restore point

### `GET /vps/{serviceName}/automatedBackup/attachedBackup`
List backups currently attached to this VPS
- returns: `vps.automatedBackup.Attached[]`
- params:
  - `serviceName`: string [path] — Service name

### `POST /vps/{serviceName}/automatedBackup/restore`
Restore this VPS from a given restore point and return an asynchronous task
- returns: `vps.Task`
- params:
  - `(body)`: vps.automatedBackup.restore.post [body] — Request Body
  - `serviceName`: string [path] — Service name

### `GET /vps/{serviceName}/disks`
List disks attached to this VPS
- returns: `long[]`
- params:
  - `serviceName`: string [path] — Service name

### `GET /vps/{serviceName}/disks/{id}/use`
Retrieve current disk usage metrics for this VPS
- returns: `complexType.UnitAndValue_double`
- params:
  - `id`: long [path] — Id
  - `serviceName`: string [path] — Service name
  - `type`: vps.disk.StatisticTypeEnum [query] — The type of statistic to be fetched

### `GET /vps/{serviceName}/disks/{id}/monitoring`
Retrieve disk monitoring statistics for this VPS over a given period
- returns: `complexType.UnitAndValues_vps.VpsTimestampValue`
- params:
  - `id`: long [path] — Id
  - `period`: vps.VpsMonitoringPeriodEnum [query] — The period the statistics are fetched for
  - `serviceName`: string [path] — Service name
  - `type`: vps.disk.StatisticTypeEnum [query] — The type of statistic to be fetched

### `GET /vps/{serviceName}/availableUpgrade`
List models this VPS can be upgraded to
- returns: `vps.Model[]`
- params:
  - `serviceName`: string [path] — Service name

### `POST /vps/{serviceName}/setPassword`
Trigger the process to reset/set the root password on this VPS and return an asynchronous task
- returns: `vps.Task`
- params:
  - `serviceName`: string [path] — Service name

### `POST /vps/{serviceName}/terminate`
Request termination of this VPS service
- returns: `string`
- params:
  - `serviceName`: string [path] — Service name

### `POST /vps/{serviceName}/confirmTermination`
Confirm the termination of this VPS service
- returns: `string`
- params:
  - `(body)`: services.confirmTermination [body] — Request Body
  - `serviceName`: string [path] — Service name

### `GET /vps/{serviceName}/option`
List options attached to this VPS
- returns: `vps.VpsOptionEnum[]`
- params:
  - `serviceName`: string [path] — Service name

### `DELETE /vps/{serviceName}/option/{option}`
Release an option attached to this VPS (deprecated)
- returns: `void`
- params:
  - `deleteNow`: boolean [query] (optional) — Delete option now, don't wait for expiration
  - `option`: vps.VpsOptionEnum [path] — Option
  - `serviceName`: string [path] — Service name


## schema `order` (apiVersion 1.0)

### `POST /order/cart`
Create a new OVH order cart
- returns: `order.cart.Cart`
- params:
  - `(body)`: order.cart.Creation [body] — Request Body

### `POST /order/cart/{cartId}/assign`
Assign an order cart to your account
- returns: `void`
- params:
  - `cartId`: string [path] — Cart ID

### `GET /order/cart/{cartId}/vps`
Get information about VPS offers
- returns: `order.cart.GenericProductDefinition[]`
- params:
  - `cartId`: string [path] — Cart ID

### `POST /order/cart/{cartId}/vps`
Post a new VPS item in your cart
- returns: `order.cart.Item`
- params:
  - `(body)`: order.cart.GenericProductCreation [body] — Request Body
  - `cartId`: string [path] — Cart ID

### `POST /order/cart/{cartId}/item/{itemId}/configuration`
Setup configuration item for the product
- returns: `order.cart.ConfigurationItem`
- params:
  - `(body)`: order.cart.ItemConfigurationCreation [body] — Request Body
  - `cartId`: string [path] — Cart ID
  - `itemId`: long [path] — Item ID

### `GET /order/cart/{cartId}/vps/options`
Get information about VPS options
- returns: `order.cart.GenericOptionDefinition[]`
- params:
  - `cartId`: string [path] — Cart ID
  - `planCode`: string [query] — Identifier of the VPS you want to consult options

### `POST /order/cart/{cartId}/vps/options`
Post a new VPS option in your cart
- returns: `order.cart.Item`
- params:
  - `(body)`: order.cart.GenericOptionCreation [body] — Request Body
  - `cartId`: string [path] — Cart ID

### `GET /order/cart/{cartId}/checkout`
Get prices and contracts information for your cart
- returns: `order.Order`
- params:
  - `cartId`: string [path] — Cart ID

### `POST /order/cart/{cartId}/checkout`
Validate your shopping and create order
- returns: `order.Order`
- params:
  - `(body)`: order.cart.Checkout [body] — Request Body
  - `cartId`: string [path] — Cart ID

### `GET /order/cart/{cartId}/summary`
Get a summary of your current order
- returns: `order.Order`
- params:
  - `cartId`: string [path] — Cart ID

### `GET /order/upgrade/vps/{serviceName}/{planCode}`
Get a provisional order for the selected upgrade of your service
- returns: `order.upgrade.OperationAndOrder`
- params:
  - `planCode`: string [path] — Plan code of the offer you want to upgrade to
  - `quantity`: long [query] — Quantity you want to upgrade to
  - `serviceName`: string [path] — The internal ID of your VPS service

### `POST /order/upgrade/vps/{serviceName}/{planCode}`
Perform the requested upgrade of your service
- returns: `order.upgrade.OperationAndOrder`
- params:
  - `autoPayWithPreferredPaymentMethod`: boolean [body] (optional) — Indicates that order will be automatically paid with preferred payment method
  - `planCode`: string [path] — Plan code of the offer you want to upgrade to
  - `quantity`: long [body] — Quantity you want to upgrade to
  - `serviceName`: string [path] — The internal ID of your VPS service

### `GET /order/cartServiceOption/vps/{serviceName}`
Get informations about additional VPS offer for your service
- returns: `order.cart.GenericOptionDefinition[]`
- params:
  - `serviceName`: string [path] — The internal ID of your VPS service

### `POST /order/cartServiceOption/vps/{serviceName}`
Post an additional VPS option in your cart
- returns: `order.cart.Item`
- params:
  - `cartId`: string [body] — Cart identifier
  - `duration`: string [body] — Duration selected for the purchase of the product
  - `planCode`: string [body] — Identifier of the additional VPS offer
  - `pricingMode`: string [body] — Pricing mode selected for the purchase of the product
  - `quantity`: long [body] — Quantity of product desired
  - `serviceName`: string [path] — The internal ID of your VPS service


## schema `me` (apiVersion 1.0)

### `GET /me/order/{orderId}/status`
Return status of order
- returns: `billing.order.OrderStatusEnum`
- params:
  - `orderId`: long [path]

### `GET /me/order/{orderId}/details`
Give access to all entries of the order
- returns: `long[]`
- params:
  - `orderId`: long [path]

### `GET /me/order/{orderId}`
Get this object properties
- returns: `billing.Order`
- params:
  - `orderId`: long [path]

### `POST /me/order/{orderId}/payWithRegisteredPaymentMean`
Pay with an already registered payment mean
- returns: `void`
- params:
  - `orderId`: long [path]
  - `paymentMean`: billing.ReusablePaymentMeanEnum [body] — The registered payment mean you want to use
  - `paymentMeanId`: long [body] (optional) — Id of registered payment mean, mandatory for bankAccount, creditCard and paypal


## schema `ip` (apiVersion 1.0)

### `GET /ip/{ip}/reverse`
List reverses
- returns: `ip[]`
- params:
  - `ip`: ipBlock [path]

### `POST /ip/{ip}/reverse`
Create a reverse
- returns: `ip.ReverseIp`
- params:
  - `ip`: ipBlock [path]
  - `ipReverse`: ip [body]
  - `reverse`: string [body]

### `GET /ip/{ip}/firewall`
List firewalled IPs
- returns: `ipv4[]`
- params:
  - `enabled`: boolean [query] (optional) — Filter the value of enabled property (=)
  - `ip`: ipBlock [path]
  - `state`: ip.FirewallStateEnum [query] (optional) — Filter the value of state property (=)

### `POST /ip/{ip}/firewall`
Create a firewalled IP
- returns: `ip.FirewallIp`
- params:
  - `ip`: ipBlock [path]
  - `ipOnFirewall`: ipv4 [body]

### `GET /ip/{ip}/firewall/{ipOnFirewall}/rule`
List rules
- returns: `long[]`
- params:
  - `ip`: ipBlock [path]
  - `ipOnFirewall`: ipv4 [path]
  - `state`: ip.FirewallRuleStateEnum [query] (optional) — Filter the value of state property (=)

### `POST /ip/{ip}/firewall/{ipOnFirewall}/rule`
Create a rule
- returns: `ip.FirewallNetworkRule`
- params:
  - `action`: ip.FirewallActionEnum [body] — Action on this rule
  - `destinationPort`: long [body] (optional) — Destination port for your rule. Only with TCP/UDP protocol
  - `destinationPortRange`: complexType.Range<long> [body] (optional) — Destination port range for your rule. Only with TCP/UDP protocol. Cannot be set alongside destinationPort.
  - `ip`: ipBlock [path]
  - `ipOnFirewall`: ipv4 [path]
  - `l3PacketLength`: complexType.Range<long> [body] (optional) — IP packet's total length
  - `protocol`: ip.FirewallProtocolEnum [body] — Network protocol
  - `sequence`: ip.FirewallSequenceRangeEnum [body] — Sequence number of your rule
  - `source`: ipv4Block [body] (optional) — Source ip for your rule. Any if not set
  - `sourcePort`: long [body] (optional) — Source port for your rule. Only with TCP/UDP protocol
  - `sourcePortRange`: complexType.Range<long> [body] (optional) — Source port range for your rule. Only with TCP/UDP protocol. Cannot be set alongside sourcePort.
  - `tcpOption`: ip.FirewallOptionTCP [body] (optional) — Option on your rule. Can only be used with TCP protocol

### `GET /ip/{ip}/mitigation`
List mitigation entries
- returns: `ipv4[]`
- params:
  - `auto`: boolean [query] (optional) — Filter the value of auto property (=)
  - `ip`: ipBlock [path]
  - `state`: ip.MitigationStateEnum [query] (optional) — Filter the value of state property (=)
