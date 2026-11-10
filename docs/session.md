# Sessions, tokens and device signals

The API signs users in with **two tokens**:

- a short-lived **access token**: a JWT, 15 minutes by default;
- a long-lived, single-use **refresh token**, which buys the next pair (`refreshSession`).

They travel one of two ways:

- **cookie mode** (`cookies: true`, for browsers): the api sets both as httpOnly, Secure, SameSite=Strict
  cookies, and no token ever reaches JavaScript or the storage. Needs an api with cookie sessions;
- **bearer mode** (the default, for Node.js, workers and native apps): the tokens come back in the answer
  and the access token is sent as `Authorization: Bearer`.

The SDK's **session manager** handles them for you, with no dependency and no framework:

- it keeps the tokens in memory by default, or in storage you choose;
- it refreshes shortly before the access token expires, and once more if a request comes back
  `UNAUTHENTICATED`;
- one refresh at a time: parallel requests share it, and so do tabs (Web Locks);
- it tells any UI library when the session changes;
- it sends **device signals** with login and refresh, so the server can bind the refresh token to the device.

```mermaid
sequenceDiagram
  participant UI as Your UI (any library)
  participant S as session manager
  participant API as api (POST /graphql)
  UI->>S: client.auth.login({ email, password })
  S->>API: login(input + device)
  API-->>S: accessToken (15 min) + refreshToken
  S-->>UI: snapshot { status: signed_in, user }
  UI->>API: queries (Bearer accessToken)
  Note over S: access token expires in < 30 s
  S->>API: refreshSession(refreshToken, device) — once, shared by every caller and tab
  API-->>S: new accessToken + new refreshToken (old one spent)
  UI->>API: a request comes back UNAUTHENTICATED
  S->>API: refresh, then retry the request once
  API-->>S: INVALID_TOKEN (spent, expired, other device)
  S-->>UI: snapshot { status: signed_out }, onSignedOut("refresh_failed")
```

## Setup

### Browsers: cookie mode

```ts
import { createMgplGraphQLClient, createSessionManager, webSessionStorage } from "@mgpl-diagnostics/client";

const session = createSessionManager({
  url: "/graphql",
  cookies: true,                           // tokens in httpOnly cookies, set and read by the api
  storage: webSessionStorage(),            // only { cookie, accessExpiresAt, refreshExpiresAt, user }: survives reloads, syncs tabs
  onSignedOut: (reason) => router.push("/login"),
});
const mgpl = createMgplGraphQLClient({ url: "/graphql", session });

await mgpl.auth.login({ email, password });   // the api sets the cookies; accessToken and refreshToken are null
await mgpl.auth.logout();                     // the api ends the session and clears the cookies
```

Every request carries `x-mgpl-auth: cookie` and `credentials: "include"`. The api reads the cookies only
with that header and from an allowed origin (its own host or `CORS_ORIGINS`), which is its CSRF check:
a cross-site form cannot send a custom header. `session.fetch` and `session.headers()` add the header too;
a library that takes only headers must also send `credentials: "include"`.

The refresh works as in bearer mode (shortly before `accessExpiresAt`, once more on `UNAUTHENTICATED`, one
at a time across tabs), with `refreshSession(device)` and no token. `accessToken()` is always null.
A page served from another site than the api needs `AUTH_COOKIE_SAMESITE=none` on the api; same site
(`app.lab.in` and `api.lab.in`, or one origin behind a proxy) works with the default.

### Node.js, workers, native apps: bearer mode

```ts
// default: tokens in memory (lost on reload)
const mgpl = createMgplGraphQLClient({ url: "https://api.your-lab.in/graphql" });

// or your own storage: SecureStore / Keychain on React Native, safeStorage in Electron
const session = createSessionManager({ url: "https://api.your-lab.in/graphql", storage: mySecureStorage });
const mgpl2 = createMgplGraphQLClient({ url: "https://api.your-lab.in/graphql", session });

await mgpl2.auth.login({ email, password });   // device signals are added for you
await mgpl2.auth.logout();                     // ends the server session (by refresh token), clears storage
```

Don't use `webSessionStorage()` in bearer mode in a browser: localStorage is readable by any script on the
page, so an XSS bug could copy the refresh token. Use cookie mode there.

`SessionStorage` is `{ get(), set(value), subscribe?(listener) }`. On React Native, implement it on
SecureStore or Keychain; in Electron, on safeStorage. In cookie mode it never receives a token.

| Session manager | |
| --- | --- |
| `getSnapshot()` / `subscribe(listener)` | `{ status, user, accessExpiresAt, refreshExpiresAt }`; same object until it changes |
| `store` | Svelte-style readable store |
| `cookies` | true in cookie mode |
| `accessToken()` | a valid access token (refreshed first when needed) or null; always null in cookie mode |
| `refresh()` | single-flight refresh; true when it worked |
| `signIn(result)` / `signOut(reason?)` / `current()` | keep, forget or read the tokens |
| `headers()` | `{ authorization }` (cookie mode: `{ "x-mgpl-auth": "cookie" }`) for clients that take a headers function |
| `fetch` | a fetch that adds the token (cookie mode: the header and credentials) and refreshes and retries once on `UNAUTHENTICATED` |
| `device()` | the device signals |

Options: `url`, `cookies` (default false), `fetch`, `storage`, `device` (a collector, or `false`), `refreshMarginMs` (default 30 s),
`headers`, `onSignedOut`.

## Any UI or data library

```tsx
// React
import { useMgplSession } from "@mgpl-diagnostics/client/react";
const { status, user } = useMgplSession(mgpl.session);   // useSyncExternalStore underneath

// Svelte
{#if $store.status === "signed_in"} … {/if}               // const store = mgpl.session.store

// Vue
const s = shallowRef(mgpl.session.getSnapshot());
onScopeDispose(mgpl.session.subscribe((v) => (s.value = v)));
```

### TanStack Query (React, Vue, Svelte, Solid, Angular)

```ts
import { mgplQuery, mgplMutation, mgplKey, clearOnSignOut } from "@mgpl-diagnostics/client";

const invoices = useQuery(mgplQuery(mgpl, "invoices", { limit: 20 }));       // { queryKey, queryFn }
const issue = useMutation({ ...mgplMutation(mgpl, "issueInvoice"), onSuccess: () => qc.invalidateQueries({ queryKey: ["mgpl", "invoices"] }) });
clearOnSignOut(mgpl.session, qc);                                             // no cached data after logout
```

Keys are `["mgpl", operationName, variables]`; invalidate `["mgpl"]` to refetch everything. Typed
methods work too: `queryFn: () => mgpl.invoices.list({ limit: 20 })`.

### SWR, RTK Query, Apollo, urql, graphql-request

```ts
useSWR(mgplKey("invoices", { limit: 20 }), mgplFetcher(mgpl));                // SWR
new HttpLink({ uri: "https://api.your-lab.in/graphql", fetch: session.fetch }); // Apollo
createClient({ url: "https://api.your-lab.in/graphql", fetch: session.fetch, exchanges: [fetchExchange] }); // urql
new GraphQLClient(url, { fetch: session.fetch });                            // graphql-request
fetchBaseQuery({ baseUrl, fetchFn: session.fetch });                          // RTK Query
```

## Device signals

Login and refresh carry `device: { deviceId, fingerprint, clientSessionId, info }`. The server stores
them on the session. A refresh from **another `deviceId` ends the session** (`DEVICE_BINDING=enforce`,
the default), so a stolen refresh token does not work elsewhere. A changed fingerprint is only logged,
because browser updates change it.

| Signal | What it is | Where it comes from |
| --- | --- | --- |
| `deviceId` | random id, created once | `localStorage` key `mgpl.deviceId` (memory where unavailable) |
| `clientSessionId` | random id per tab or app run | `sessionStorage` key `mgpl.tabId` |
| `fingerprint` | SHA-256 (32 hex characters) of OS, browser family, mobile, platform, language, time zone, screen size, colour depth, CPU cores, device memory and touch points; the browser version is left out so updates don't change it | WebCrypto |
| `info` | `os`, `browser`, `browserVersion` (major only), `mobile`, `language`, `timezone`, `screen`, plus your `extraInfo` | `navigator`, `screen`, `Intl` |

The values are collected by [security-kit](https://github.com/mgpl-diagnostics/security-kit)
(`@mgpl-diagnostics/security-kit/browser`), which is bundled into this package, so the SDK still has no
runtime dependency. Devices that signed in before 1.3.0 keep their `deviceId`.

Nothing else is read: no canvas, audio, font or IP probing, and no third-party script. Tell your users
in your privacy notice that these values are used to keep their account secure.

```ts
import { createDeviceCollector } from "@mgpl-diagnostics/client";

const device = createDeviceCollector({
  store: secureStoreAdapter,                                      // React Native: keep the id in SecureStore
  extraInfo: () => ({ appVersion: "2.3.0", model: Device.modelName }),
  exclude: ["screen"],
});
const session = createSessionManager({ url, device });             // or device: false to send none
```

To share one collector with the rest of your app (for example security-kit's `signalFetch` or
`useDeviceSignals`), pass it in:

```ts
import { createSignalCollector } from "@mgpl-diagnostics/security-kit/browser";

const signals = createSignalCollector({ app: "lab-panel@1.4.0" });
const device = createDeviceCollector({ signals }); // the session manager sends the same ids
```
