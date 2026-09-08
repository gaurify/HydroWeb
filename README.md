# HydroWeb

> **Stay hydrated. Stay focused. Stay ready.**

A Spider-Man inspired hydration reminder application built for **Windows and Web**, designed to help users stay hydrated through smart reminders, hydration tracking, notifications, and an interactive visual experience.

---

## Overview

**HydroWeb** is a hydration and wellness companion that combines a Spider-Man inspired interface with practical hydration tracking.

The application provides customizable reminders, real-time countdowns, hydration logging, daily goals, streak tracking, desktop notifications, audio feedback, and optional cloud synchronization through Appwrite.

Built with both **desktop and web experiences** in mind, HydroWeb aims to make something as simple as drinking enough water more engaging and interactive.

---

## Features

### 🕷️ Spider-Man Inspired Experience

* Spider-Man themed animated interface
* Interactive visual overlays
* Web-inspired animations and effects
* Immersive dark-themed experience
* Audio feedback including web-thwip and water-drop sounds

###  Hydration Tracking

* Record water consumption in mL
* Track daily hydration progress
* Set and monitor daily hydration goals
* Maintain hydration streaks
* View your current progress throughout the day

###  Smart Reminders

* Configurable hydration reminder intervals
* Custom active-hours window
* Live countdown until the next reminder
* Desktop notifications
* Reminder controls directly from the application

###  Windows Desktop Application

* Native desktop experience
* System tray minimization
* Tray controls for quick access
* Windows executable packaging
* Background reminder support

###  Web Application

* Browser-based version of HydroWeb
* Local development server
* Responsive interface
* Accessible directly through a web browser

###  Appwrite Integration

* Appwrite Cloud / self-hosted backend support
* Synchronization of application settings
* Hydration statistics synchronization
* Persistent user data storage

---

## Tech Stack

| Technology                | Purpose                                |
| ------------------------- | -------------------------------------- |
| **HTML5**                 | Application structure                  |
| **CSS3**                  | Styling, animations and visual effects |
| **JavaScript**            | Application logic and interactions     |
| **Node.js**               | Web server and application runtime     |
| **Electron**              | Windows desktop application            |
| **Appwrite**              | Backend and cloud synchronization      |
| **Web Notifications API** | Desktop/browser reminders              |
| **Git & GitHub**          | Version control and collaboration      |

---

## How It Works

HydroWeb combines a hydration tracker with a customizable reminder system.

1. Set your daily hydration goal.
2. Choose how frequently you want hydration reminders.
3. Configure your active hours.
4. Log the amount of water you drink.
5. Monitor your daily progress.
6. Maintain your hydration streak.
7. Receive notifications when it's time to hydrate.

The desktop application can continue running in the background through the Windows system tray, allowing reminders to work without keeping the main window open.

---

## Quick Start

### Prerequisites

Make sure you have the following installed:

* **Node.js**
* **npm**
* **Git**

---

### 1. Clone the Repository

```bash
git clone https://github.com/gaurify/HydroWeb.git
cd HydroWeb
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Desktop Application

```bash
npm start
```

This launches the HydroWeb desktop application.

---

### 4. Run the Web Application

```bash
npm run web
```

Then open:

```text
http://localhost:3000
```

in your browser.

---

### 5. Package the Windows Application

```bash
npm run package
```

This creates the packaged Windows application according to the project's Electron packaging configuration.

---

## Configuration

If you are using Appwrite synchronization, configure your Appwrite project and provide the required project configuration according to the application's environment/configuration files.

> **Never commit private API keys, secrets, or credentials to GitHub.**

For local development, keep sensitive configuration in environment variables or a local configuration file that is excluded from version control.

---


## Notifications

HydroWeb can provide desktop/browser notifications when it is time to hydrate.

The reminder system is designed around customizable intervals and active hours so users can adapt HydroWeb to their own routine.

---

## Audio Feedback

HydroWeb includes lightweight audio feedback to make reminders more interactive.

Examples include:

* Web-inspired notification sounds
* Water-drop sounds
* Reminder audio cues

---

## Desktop Experience

The Windows version of HydroWeb is designed to work quietly in the background.

The application can be minimized to the **system tray**, allowing users to keep hydration reminders active without having the main application window constantly open.

---

## Cloud Synchronization

HydroWeb supports **Appwrite** for backend synchronization.

Depending on the configured backend, HydroWeb can synchronize:

* Application settings
* Hydration statistics
* Daily progress
* User preferences

This allows data to persist beyond a single local session.

---


---

## Why HydroWeb?

Staying hydrated is simple, but remembering to do it consistently can be difficult.

HydroWeb turns hydration reminders into an interactive experience rather than another boring notification.

The goal is simple:

> **Make healthy habits feel less like a task and more like an experience.**

---

## Project Status

**Status:** Active Development 🚧

HydroWeb is currently being developed and improved with new features, UI enhancements, and functionality planned for future releases.

---



---

## Credits

Created by **Gauri Inamdar**

Built with curiosity, creativity, and a little bit of Spider-Man energy.

---

## License

This project is licensed under the **MIT License**.

See the `LICENSE` file for more information.

---

## ⭐ Support

If you like HydroWeb or find the project interesting, consider giving the repository a **star** on GitHub.

It helps support the project and motivates further development.

**Stay hydrated. Stay focused. Stay ready. 
