# NEXTJS Api folder

## Purpose

This document outlines the structure and purpose of the `/pages/api` folder. The goal is to provide a clear understanding of the usage and advantages.

---

## Folder Structure

The `/pages/api` folder contains all the API routes for the Next.js application. Each file in this folder represents a different API route that can be accessed by the client-side code.

The general structure:

```
/pages
  /api
    /bridge
      - [route1].ts
      - [route2].ts
    /peanut
      - [route1].ts
      - [route2].ts
    - ...
```

---

## Advantages

1. **Separation of Concerns**: By keeping all API routes in a separate folder, it helps in maintaining a clear separation between client-side and server-side code.
2. **Scalability**: As the application grows, adding new API routes becomes easier and more organized.
3. **Security**: API routes are server side, so they hide sensitive information and logic from the client.

---

## Proxies

We have a couple of different proxies that are used in the `/pages/api` folder. These proxies are used to route requests to the appropriate API handlers based on the URL path. This is done for our SDK, in our SDK we have api calls happening and if we route them through our proxies we can hide the API keys and other sensitive information from the client. We have proxies for GET, PATCH and POST requests.
