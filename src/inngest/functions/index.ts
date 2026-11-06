import { alertRaise } from "./alerts"
import { catalogSync } from "./catalog-sync"
import { checkOrderDelivery, provisionOrder } from "./provision"
import { dunningStep, paymentFailed, paymentSucceeded, renewalTick } from "./renewals"
import { serviceSync } from "./service-sync"

/** Every function served at `/api/inngest`. Adding one here is all the registration needed. */
export const functions = [
  provisionOrder,
  checkOrderDelivery,
  renewalTick,
  dunningStep,
  paymentSucceeded,
  paymentFailed,
  catalogSync,
  serviceSync,
  alertRaise,
]

export {
  alertRaise,
  catalogSync,
  checkOrderDelivery,
  dunningStep,
  paymentFailed,
  paymentSucceeded,
  provisionOrder,
  renewalTick,
  serviceSync,
}
