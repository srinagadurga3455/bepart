/**
 * Razorpay Checkout integration for participant payments.
 *
 * Only the PUBLIC key id (returned by POST /payments/init as
 * `razorpayKeyId`) ever reaches the browser. Secrets stay on the backend,
 * which creates orders and verifies signatures.
 */

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface OpenCheckoutArgs {
  /** Public key id from POST /payments/init (never a secret). */
  key: string;
  /** Razorpay order id from POST /payments/init. */
  orderId: string;
  /** Final payable amount in PAISE (converted from backend rupees at this boundary). */
  amountPaise: number;
  eventName?: string;
  prefillName?: string;
  prefillContact?: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', cb: (resp: { error?: { description?: string; reason?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const CHECKOUT_JS_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let loadPromise: Promise<void> | null = null;

/** Load checkout.js once. Rejects when the CDN is unreachable (offline). */
export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_JS_URL;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve();
      else {
        loadPromise = null;
        reject(new Error('Razorpay Checkout failed to initialise. Check your connection and retry.'));
      }
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Could not load Razorpay Checkout (network error). Check your connection and retry.'));
    };
    document.body.appendChild(script);
  });
  return loadPromise;
}

export type CheckoutDismissal =
  | { reason: 'dismissed' }
  | { reason: 'failed'; description: string };

/**
 * Open Razorpay Checkout for an existing order. Resolves with the checkout
 * response (caller must POST it to /payments/verify — success here is NOT
 * payment confirmation). Rejects when the user cancels or the payment fails.
 */
export function openRazorpayCheckout(args: OpenCheckoutArgs): Promise<RazorpaySuccessResponse> {
  return loadRazorpayCheckout().then(
    () =>
      new Promise<RazorpaySuccessResponse>((resolve, reject) => {
        if (!window.Razorpay) {
          reject(new Error('Razorpay Checkout is unavailable. Retry when online.'));
          return;
        }
        let settled = false;
        const rzp = new window.Razorpay({
          key: args.key,
          order_id: args.orderId,
          amount: args.amountPaise,
          currency: 'INR',
          name: 'BePart',
          description: args.eventName ? `Registration — ${args.eventName}` : 'Event registration',
          prefill: {
            ...(args.prefillName ? { name: args.prefillName } : {}),
            ...(args.prefillContact ? { contact: args.prefillContact } : {}),
          },
          theme: { color: '#2557F5' },
          modal: {
            // User closed Checkout without paying: keep the PENDING payment so
            // they can retry with the same order (no duplicate init needed).
            ondismiss: () => {
              if (!settled) {
                settled = true;
                const err = new Error('Payment cancelled — no amount was charged. You can retry.');
                (err as Error & { checkoutDismissal: CheckoutDismissal }).checkoutDismissal = { reason: 'dismissed' };
                reject(err);
              }
            },
          },
          handler: (resp: RazorpaySuccessResponse) => {
            if (!settled) {
              settled = true;
              resolve(resp);
            }
          },
        });
        rzp.on('payment.failed', (resp) => {
          if (!settled) {
            settled = true;
            const description = resp?.error?.description || resp?.error?.reason || 'Payment failed.';
            const err = new Error(`${description} No registration was created — you can retry.`);
            (err as Error & { checkoutDismissal: CheckoutDismissal }).checkoutDismissal = {
              reason: 'failed',
              description,
            };
            reject(err);
          }
        });
        rzp.open();
      }),
  );
}

/** True when the error is a user-cancelled Checkout (safe to retry silently). */
export function isCheckoutDismissal(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err as Error & { checkoutDismissal?: CheckoutDismissal }).checkoutDismissal?.reason === 'dismissed'
  );
}
