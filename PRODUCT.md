# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing static HTML/CSS/vanilla JavaScript and Three.js in `public/`, published through GitHub Pages, plus an optional local Fastify + PostgreSQL room catalog (`server/rooms/`) for editing room capacities and computer counts.

## Users

Students, applicants, and visitors exploring СПбГУПТД (Вознесенский, 44–46) to find a room, university service, or study area, and campus staff maintaining local room counts or route closures.

## Product Purpose

An interactive five-floor 3D/2D campus map of Вознесенский, 44–46 with room, service, and workspace search, cross-floor educational routes, local `.xlsx`/`.json` schedule import, temporary closure preview, EmailJS feedback, and an optional PostgreSQL-backed room inventory catalog with live 3D interior updates.

## Operating Context

Primary public deployment runs completely statically from `public/` without requiring a backend API; 2D fallback, keyboard navigation, and mobile responsiveness are maintained throughout. Workspace seat reservations were retired in favour of informative wayfinding and room-equipment modeling.

## Capabilities and Constraints

Five floors (archive 2012 sheets on floors 1 and 5; 2026 wayfinding panels on floors 2–4), 22 referenced directory records with explicit approximate placements (`≈`), 8 illustrative study-space profiles, university services catalog, and client-side schedule/closure storage. No real-time occupancy, live university schedule sync, audited accessibility routes, or evacuation guidance is claimed; step-free routing fails closed until verified elevator/passage survey data is supplied.

## Brand Commitments

Name: «внутри.»; creative/design university СПбГУПТД. Quiet architectural model identity using Golos typography, dark-green primary accent (`#285443`), route blue (`#0064cf`), neutral light surfaces, and honest disclosure of archive vs. wayfinding-panel sources.

## Evidence on Hand

`public/data/floor-geometry.json` and `public/data/floor-spaces.json` combine 2012 archive footprints on floors 1 and 5 with 2026 wayfinding panels on floors 2–4; `public/data/directory.json` keeps current, historical, and conflicting room records; `public/js/room-placements.js` marks spatial guesses with `≈`. Optional `server/rooms/` imports local `.xlsx` room inventory into PostgreSQL without publishing raw spreadsheet notes or department fields.

## Product Principles

- A coherent architectural scale model, immediately recognizable as a designed university experience.
- Building/model is the primary visual and interaction surface.
- Different rooms and equipment profiles remain clearly distinguishable in 3D and 2D.
- Search, route steps, and schedule navigation remain fast and keyboard/mobile accessible.
- Conceptual content and approximate placements are disclosed honestly and never presented as surveyed plans.

## Delivery Priority

Desktop visual quality and spatial legibility are primary acceptance targets, while mobile remains functional without horizontal overflow.

## Accessibility & Inclusion

Keyboard alternative to canvas, visible focus, mobile layout, non-colour-only states, reduced-motion behavior, and fail-closed step-free routing. No claims of audited WCAG compliance or verified real-campus accessible routes.
