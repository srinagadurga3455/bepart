import { useState } from "react";
import "./App.css";

function Product() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const API_BASE_URL =
    process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

  const amount = 5;
  const amountPaise = amount * 100;
  const currency = "INR";
  const configuredEventId = Number(process.env.REACT_APP_EVENT_ID);

  const readBackendError = async (response, fallback) => {
    try {
      const data = await response.json();
      if (typeof data?.message === "string" && data.message.trim()) {
        return data.message;
      }
      if (Array.isArray(data?.message) && data.message.length > 0) {
        return data.message.join(", ");
      }
    } catch (parseError) {
      console.error("Could not parse backend error response", parseError);
    }
    return `${fallback} (HTTP ${response.status})`;
  };

  const resolvePaidEventId = async () => {
    if (Number.isInteger(configuredEventId) && configuredEventId > 0) {
      return configuredEventId;
    }

    const response = await fetch(`${API_BASE_URL}/api/events/public?limit=50`);
    if (!response.ok) {
      throw new Error(
        await readBackendError(response, "Failed to load available events")
      );
    }

    const data = await response.json();
    const events = Array.isArray(data) ? data : data?.data;
    const paidEvent = Array.isArray(events)
      ? events.find((event) => event?.paymentRequired === true)
      : undefined;

    if (!paidEvent) {
      throw new Error("No paid event is currently available for registration.");
    }

    return paidEvent.id;
  };

  const paymentHandler = async (e) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.phone) {
      setMessage("Please fill in all the details.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setMessage("Please enter a valid email address.");
      return;
    }

    if (!/^\d{10}$/.test(form.phone.trim())) {
      setMessage("Please enter a valid 10-digit phone number.");
      return;
    }

    setMessage("");
    setLoading(true);

    try {
      if (!window.Razorpay) {
        throw new Error(
          "Razorpay Checkout is not loaded. Please check your connection and refresh."
        );
      }

      const eventId = await resolvePaidEventId();

      const initResponse = await fetch(`${API_BASE_URL}/api/payments/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          phone: form.phone.trim(),
          amount: amountPaise,
          pendingFormData: {
            fullName: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
          },
        }),
      });

      if (!initResponse.ok) {
        throw new Error(
          await readBackendError(initResponse, "Failed to create payment order")
        );
      }

      const init = await initResponse.json();

      if (!init?.razorpayOrderId || !init?.razorpayKeyId) {
        throw new Error("Invalid payment initialization response from backend.");
      }

      const options = {
        key: init.razorpayKeyId,
        amount: init.amount,
        currency: currency,

        name: "Bepart",
        description: "Bepart Registration",
        order_id: init.razorpayOrderId,

        handler: function (checkoutResponse) {
          console.log("Razorpay payment response received:", {
            razorpay_order_id: checkoutResponse.razorpay_order_id,
            razorpay_payment_id: checkoutResponse.razorpay_payment_id,
          });
          setMessage(
            "Payment received! Your registration will be confirmed after backend verification."
          );
          setLoading(false);
        },

        prefill: {
          name: form.name,
          email: form.email,
          contact: form.phone,
        },

        notes: {
          purpose: "Bepart Registration",
          paymentId: init.id,
        },

        modal: {
          ondismiss: function () {
            setMessage(
              "Payment was cancelled before completion. No amount was charged."
            );
            setLoading(false);
          },
        },

        theme: {
          color: "#6366f1",
        },
      };

      const rzp1 = new window.Razorpay(options);

      rzp1.on("payment.failed", function (response) {
        const description =
          response?.error?.description || "Payment failed. Please try again.";
        console.log("Razorpay payment failed:", response?.error);

        setMessage(`Payment failed: ${description}`);
        setLoading(false);
      });

      rzp1.open();
    } catch (error) {
      console.error(error);
      setMessage(error?.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="payment-page">

      {/* Background decoration */}
      <div className="blob blob-one"></div>
      <div className="blob blob-two"></div>

      <div className="payment-container">

        {/* LEFT SIDE */}
        <div className="info-section">

          <div className="brand">
            <div className="brand-logo">B</div>
            <span>Bepart</span>
          </div>

          <div className="hero-content">
            <span className="badge">🚀 Registration Open</span>

            <h1>
              Join the <span>Bepart</span> community.
            </h1>

            <p>
              Complete your registration and unlock your
              Bepart experience in just a few simple steps.
            </p>
          </div>

          <div className="steps">

            <div className="step">
              <div className="step-number">1</div>
              <div>
                <h3>Enter Details</h3>
                <p>Provide your basic information.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <div>
                <h3>Make Payment</h3>
                <p>Pay the registration fee securely.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <div>
                <h3>You're Registered</h3>
                <p>Complete your Bepart registration.</p>
              </div>
            </div>

          </div>

          <div className="secure-box">
            <span>🔒</span>
            <div>
              <strong>Secure Payment</strong>
              <p>Payments are processed securely through Razorpay.</p>
            </div>
          </div>

        </div>

        {/* RIGHT SIDE */}
        <div className="payment-card">

          <div className="card-header">
            <div>
              <span className="small-label">REGISTRATION</span>
              <h2>Complete your registration</h2>
            </div>

            <div className="price">
              ₹{amount}
            </div>
          </div>

          <form onSubmit={paymentHandler}>

            <div className="input-group">
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                placeholder="Enter your full name"
                value={form.name}
                onChange={handleChange}
              />
            </div>

            <div className="input-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
              />
            </div>

            <div className="input-group">
              <label>Phone Number</label>

              <div className="phone-input">
                <span>+91</span>
                <input
                  type="tel"
                  name="phone"
                  placeholder="10-digit mobile number"
                  maxLength="10"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            {message && (
              <div className="error-message">
                ⚠️ {message}
              </div>
            )}

            {/* Payment Summary */}
            <div className="summary">

              <div className="summary-row">
                <span>Registration Fee</span>
                <strong>₹5</strong>
              </div>

              <div className="summary-row">
                <span>Processing</span>
                <strong>Included</strong>
              </div>

              <div className="divider"></div>

              <div className="summary-total">
                <span>Total</span>
                <strong>₹5</strong>
              </div>

            </div>

            <button
              className="pay-button"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loader"></span>
                  Processing...
                </>
              ) : (
                <>
                  Pay
                  <span>→</span>
                </>
              )}
            </button>

            <div className="payment-methods">
              <span>💳 Cards</span>
              <span>🏦 Netbanking</span>
              <span>📱 UPI</span>
            </div>

            <p className="terms">
              By continuing, you agree to the registration
              terms and conditions.
            </p>

          </form>
        </div>

      </div>
    </div>
  );
}

export default Product;