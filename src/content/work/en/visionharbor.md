---
title: 'Port workforce management, Port of Málaga'
summary: 'A full-stack platform for scheduling stevedoring personnel, shifts and qualifications at the Port of Málaga, built at Vision Harbor Technologies with .NET and React.'
role: 'Full-stack Software Engineer'
stack: ['C# / .NET', 'React', 'TypeScript', 'SQL', 'CI/CD', 'Claude Code']
year: 2026
locale: 'en'
url: 'https://visionharbor.ai'
productUrl: 'https://visionone.visionharbor.ai'
featured: true
order: 1
---

## The problem

A container ship does not wait. When it berths at the Port of Málaga, a gang of stevedores has to be on the quay inside the right shift, with the right qualifications and valid machinery certifications — and the roster that puts them there is built from constraints that move by the hour. Vessel arrivals shift. People fall ill. A crane licence expires. The port works around the clock, and a gang one qualified hand short is a gang that cannot work the ship.

Sitting on top of that is a question that has nothing to do with scheduling: who is allowed to see this, and who is allowed to change it. A foreman planning tomorrow's shifts, an operations manager reviewing cost, an administrator maintaining qualification records and a worker checking their own roster are four different people who need four different views of the same data.

## What I build

VisionOne is the platform Vision Harbor Technologies runs for that job, and I work on it full-stack. Backend in C# and .NET, frontend in React. The work covers the whole vertical — data model, API, business rules and interface: personnel records and qualifications, shift and gang composition, availability, and the operational screens the port's planners use while a shift is running.

## Access and permissions

I ran an architecture analysis of the application and proposed a redesign of its access and permissions model. The original model answered "what role does this user have" when the operational question is "what may this user do to this record, in this operation, right now". I mapped the permission surface, pinpointed where authorisation decisions were spread across too many places to reason about safely, and proposed a model that concentrates them in a single enforceable layer — so a new screen inherits the rules instead of reimplementing them.

## How it ships

AI is wired into the development cycle: Claude Code for task automation and assisted code generation, which shortens the distance between a decided change and a reviewed one. I also work the DevOps side — deployments, CI/CD pipelines, and organising how the team's work moves from branch to production.
