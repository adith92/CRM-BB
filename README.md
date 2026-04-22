# 🚀 Fleet Management CRM System (Enterprise Demo)

A modern, enterprise-grade CRM + Fleet Management System designed for taxi / transportation companies.

This system simulates a real-world operation similar to ride-hailing platforms (Uber / Gojek) and professional fleet operators.

---

# 🎯 Project Goal

To build a scalable, modular SaaS system that combines:

* CRM (Customer Relationship Management)
* Fleet Management (Vehicles & Drivers)
* Real-time Tracking System
* Booking & Dispatch System
* Business Analytics Dashboard

---

# 🧩 Core Features

## 🧠 CRM System

* Leads & Opportunities (Pipeline Kanban)
* Contacts Management
* Activities (Tasks, Calls, Meetings)
* Dashboard with KPI & analytics

---

## 🚗 Fleet Management

* Vehicle database (CRUD)
* Vehicle status:

  * Active
  * On Trip
  * Maintenance
* Driver assignment

---

## 👨‍✈️ Driver Management

* Driver profiles
* Status tracking (online/offline/on-trip)
* Performance metrics:

  * total trips
  * rating

---

## 🗺️ Real-Time Map Tracking

* Live map (Jakarta region)
* 100 simulated vehicles
* Vehicle movement simulation
* Clickable vehicle details

---

## 📦 Booking / Dispatch System

* Simulated trip requests
* Auto-assign nearest vehicle
* Trip status flow:

  * Pending
  * Assigned
  * On Trip
  * Completed

---

## 💰 Sales Module (Basic)

* Quotation system
* Order conversion
* Auto numbering system

---

## 📅 Calendar System

* Activity scheduling
* Monthly calendar view
* Linked with CRM activities

---

## 🌐 Multi Language

* Bahasa Indonesia 🇮🇩
* English 🇺🇸

---

## 📊 Executive Dashboard

* Active vehicles
* Active drivers
* Trips today
* Revenue today
* Charts (trends & performance)

---

## 📍 Lead Capture System

* Public form (embeddable)
* UTM tracking
* Auto create leads
* Auto follow-up activity

---

# 🎨 UI / UX

* Modern enterprise design (inspired by Stripe / Linear)
* Dark mode + Light mode
* Responsive (Desktop + Mobile)
* Clean, minimal, professional look

---

# ⚙️ Tech Stack

### Frontend

* React / Next.js (auto-generated)
* TailwindCSS
* Chart libraries

### Backend

* Python (FastAPI)
* REST API
* Modular architecture

### Map

* Google Maps (optional) OR
* OpenStreetMap + Leaflet

---

# 🧪 Testing

* Backend tests: ✅ Passed
* Frontend tests: ✅ Passed
* Critical flows fully tested

---

# 📁 Project Structure

```
backend/        → API & business logic
frontend/       → UI application
tests/          → test cases
memory/         → AI-generated memory/state
.emergent/      → system configs
```

---

# 🚀 How to Run

## 1. Clone repo

```bash
git clone <your-repo-url>
cd project
```

## 2. Run Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## 3. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

---

# 🔁 Development Status

## ✅ Completed

* CRM core
* Fleet system
* Real-time map (100 vehicles)
* Dashboard
* Booking simulation
* Sales basic
* Calendar
* Multi-language

---

## 🚧 Next Roadmap

* Email / webhook notification
* Form analytics (conversion, UTM insights)
* Auto-assign driver rules
* Advanced reporting
* Mobile driver app (future)

---

# 💡 Vision

This project aims to evolve into a full **Fleet Operating System**:

* Real-time operations
* Business intelligence
* Scalable SaaS for transport companies

---

# ⚠️ Notes

This is a demo / prototype system for presentation and development purposes.

---

# 👨‍💻 Author

Developed as part of an advanced AI-assisted system building project.

---

# 🔥 Future Potential

* Integration with real GPS devices
* Mobile apps (driver + customer)
* AI-based optimization (dispatch, pricing)
* Enterprise SaaS deployment

---

END.
