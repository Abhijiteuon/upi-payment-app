import React, { useState } from 'react';
import './index.css';

function App() {
  const [formData, setFormData] = useState({
    name: '',
    purpose: '',
    source: '',
    amount: '',
    phone: '',
    email: ''
  });
  
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.name && formData.amount && formData.purpose && formData.source) {
      const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSe6ijmXl90ufpUplEoEWZj8uL92_jHt-w6kJANlf18dCTgzhA/formResponse";
      const data = new URLSearchParams();
      data.append("entry.1903499638", formData.name);
      data.append("entry.1388882637", formData.purpose);
      data.append("entry.635018705", formData.source);
      data.append("entry.794330962", formData.amount);
      data.append("entry.1805777836", formData.phone);
      data.append("entry.225713530", formData.email);

      try {
        await fetch(formUrl, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: data.toString()
        });
      } catch (err) {
        console.error("Error submitting form", err);
      }

      setIsSubmitted(true);
    }
  };

  const handleBack = () => {
    setIsSubmitted(false);
  };

  return (
    <>
      <div className="bg-shape"></div>
      <div className="container">
        <div className="glass-card">
          {!isSubmitted ? (
            <div className="fade-in">
              <div className="header">
                <h1>Pay Abhijit Securely</h1>
                <p>Complete your payment details securely</p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    className="form-control"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email ID</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="form-control"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    className="form-control"
                    placeholder="Enter your phone number"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="purpose">Purpose of Payment</label>
                  <select
                    id="purpose"
                    name="purpose"
                    className="form-control"
                    value={formData.purpose}
                    onChange={handleChange}
                    required
                  >
                    <option value="" disabled>Select a purpose</option>
                    <option value="Freelance project completion Payment">Freelance project completion Payment</option>
                    <option value="Education-venture payment">Education-venture payment</option>
                    <option value="Salary Payment">Salary Payment</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="source">Source</label>
                  <select
                    id="source"
                    name="source"
                    className="form-control"
                    value={formData.source}
                    onChange={handleChange}
                    required
                  >
                    <option value="" disabled>Select source type</option>
                    <option value="Organisation">Organisation</option>
                    <option value="Private">Private</option>
                    <option value="Individual">Individual</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="amount">Amount</label>
                  <div className="amount-input-wrapper">
                    <input
                      type="number"
                      id="amount"
                      name="amount"
                      className="form-control"
                      placeholder="0.00"
                      min="1"
                      step="0.01"
                      value={formData.amount}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="submit-btn">
                  Proceed to Pay
                </button>
              </form>
            </div>
          ) : (
            <div className="fade-in qr-placeholder">
              <h3>Scan to Pay ₹{formData.amount}</h3>
              <p>Payment for: {formData.purpose}</p>
              
              <div className="qr-box" style={{ overflow: 'hidden', padding: '10px', background: 'white' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`upi://pay?pa=euonabhijit@okicici&pn=Abhijit%20Kumar&mc=0000&tr=TXN${Date.now()}&am=${formData.amount}&cu=INR&tn=${encodeURIComponent(formData.purpose)}`)}`} 
                  alt="UPI QR Code" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              
              <p>Or pay using UPI ID</p>
              <div className="upi-id-display">
                euonabhijit@okicici
              </div>
              
              <br />
              <a 
                href={`upi://pay?pa=euonabhijit@okicici&pn=Abhijit%20Kumar&mc=0000&tr=TXN${Date.now()}&am=${formData.amount}&cu=INR&tn=${encodeURIComponent(formData.purpose)}`} 
                className="submit-btn" 
                style={{ display: 'inline-block', textDecoration: 'none', width: 'auto', padding: '0.75rem 2rem', marginBottom: '1.5rem' }}
              >
                Pay via UPI App
              </a>
              
              <div>
                <button onClick={handleBack} className="back-btn">
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
