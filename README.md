# BaseAjax

BaseAjax یک HTTP client سبک و بدون وابستگی زمان اجرا برای JavaScript است. این کتابخانه در مرورگر، ESM و CommonJS قابل استفاده است و برای دریافت و ارسال درخواست‌های HTTP، مدیریت خطا و افزودن middlewareهای اختیاری طراحی شده است.

> **مستندات کامل (فارسی، RTL):** فایل [`docs/index.html`](docs/index.html) را باز کنید یا با `npm run serve:docs` آن را روی `http://localhost:5174` سرو کنید. مستندات شامل مرجع کامل پیکربندی، خطاها، احراز هویت، retry، interceptorها، همهٔ پلاگین‌ها، انواع TypeScript و الگوهای آماده است.

## فهرست

- [نصب و شروع سریع](#نصب-و-شروع-سریع)
- [ورودی‌ها و خروجی‌های بسته](#ورودیها-و-خروجیهای-بسته)
- [ارسال درخواست](#ارسال-درخواست)
- [پیکربندی](#پیکربندی)
- [احراز هویت و CSRF](#احراز-هویت-و-csrf)
- [تلاش مجدد و لغو درخواست](#تلاش-مجدد-و-لغو-درخواست)
- [پاسخ‌ها و خطاها](#پاسخها-و-خطاها)
- [Interceptorها و ثبت رخداد](#interceptorها-و-ثبت-رخداد)
- [Transport سفارشی](#transport-سفارشی)
- [پلاگین‌ها](#پلاگینها)
- [ساخت و بررسی پروژه](#ساخت-و-بررسی-پروژه)

## نصب و شروع سریع

```bash
npm install base-ajax
```

این مثال یک client می‌سازد، آدرس پایه را تنظیم می‌کند و JSON دریافت می‌کند:

```js
import { createClient } from "base-ajax";

const api = createClient({
  baseURL: "https://api.example.com",
  responseType: "json",
});

const users = await api.get("/users", { page: 1 });
```

برای درخواست‌های GET و HEAD، آرگومان دوم query parameters است. برای POST، PUT، PATCH و DELETE آرگومان دوم بدنه درخواست است.

## ورودی‌ها و خروجی‌های بسته

```js
// ESM
import BaseAjax, { ApiError, createClient } from "base-ajax";

// CommonJS
const BaseAjax = require("base-ajax");
```

برای بارگذاری هسته و همه پلاگین‌ها با یک `<script>`، از `dist/baseAjax.all.umd.min.js` استفاده کنید. هسته و توابع پلاگین در `window.BaseAjax` در دسترس‌اند. این bundle شامل پلاگین‌های `dedupe`، `cache`، `circuitBreaker`، `queue`، `trace`، `mock` و `compose` است.

برای import از بسته، از مسیر `base-ajax/all` استفاده کنید:

```js
import BaseAjax, { cache, compose, createClient } from "base-ajax/all";
```

ورودی پلاگین‌ها برای ESM و CommonJS:

```js
import { cache, compose, dedupe } from "base-ajax/plugins";
```

## ارسال درخواست

### متدهای کوتاه

```js
const profile = await api.get("/users/42");
const page = await api.get("/users", { page: 2, active: true });
const created = await api.post("/users", { name: "Ada" });
const updated = await api.patch("/users/42", { name: "Grace" });
await api.delete("/users/42");
```

متدهای موجود `get`، `head`، `post`، `put`، `patch`، `delete` و `options` هستند. متدهای `get` و `head` داده آرگومان دوم را به query string تبدیل می‌کنند. آرایه‌ها به چند پارامتر هم‌نام تبدیل می‌شوند؛ مقدارهای `null` و `undefined` نادیده گرفته می‌شوند.

برای سازگاری با الگوی قدیمی کتابخانه، `callAPI(url, method, data, options, token)` نیز موجود است. این متد به‌طور پیش‌فرض JSON می‌خواهد و token آرگومان آخر را فقط وقتی `options.withAuth` برابر `true` باشد استفاده می‌کند.

### متد عمومی

برای کنترل دقیق‌تر از `request` استفاده کنید:

```js
const data = await api.request({
  url: "/reports",
  method: "POST",
  data: { from: "2026-01-01", to: "2026-01-31" },
  headers: { "X-Report-Mode": "monthly" },
});
```

`request` یک رشته URL یا یک شیء تنظیمات می‌پذیرد. برای GET/HEAD از `params` و برای متدهای دیگر از `data` استفاده کنید.

### فرمت بدنه

- شیءها و آرایه‌های JavaScript به JSON تبدیل می‌شوند و `Content-Type` مناسب می‌گیرند.
- `FormData`، `URLSearchParams`، `Blob`، `ArrayBuffer`، typed array و رشته بدون تبدیل ارسال می‌شوند.
- برای `FormData`، مرورگر مرز multipart را در `Content-Type` قرار می‌دهد.
- مقدارهای query از `URLSearchParams`، رشته query، شیء، آرایه، تاریخ و مقدارهای ساده پشتیبانی می‌کنند.

### Progress و متدهای جایگزین

`onUploadProgress` و `onDownloadProgress` callbackهایی دریافت می‌کنند که شیء `{ loaded, total, lengthComputable }` می‌گیرند. برای progress از transport نوع XHR استفاده می‌شود؛ در حالت `auto`، وجود این callbackها XHR را انتخاب می‌کند. Fetch این callbackها را گزارش نمی‌کند.

برای سرورهایی که PUT، PATCH یا DELETE را مستقیم نمی‌پذیرند، `methodOverride` پیش‌فرض `"header"` است و درخواست‌های trusted این متدها را با POST و header `X-HTTP-Method-Override` می‌فرستد. مقدار `false` این رفتار را خاموش می‌کند. مقدار `"body"` نام متد اصلی را به فیلد `_method` در بدنه قابل‌ویرایش اضافه می‌کند؛ برای داده‌های غیرقابل‌ویرایش، به روش header برمی‌گردد. نام header، فیلد و متدهای مشمول با `methodOverrideHeader`، `methodOverrideField` و `methodOverrideMethods` قابل تغییرند.

## پیکربندی

تنظیمات را می‌توان هنگام ساخت client یا برای هر درخواست مشخص کرد. تنظیمات درخواست بر تنظیمات client اولویت دارند. `configure(options)` تنظیمات client جاری را تغییر می‌دهد و `create(options)` یک client جدا با تنظیمات ترکیبی می‌سازد.

```js
const api = createClient({
  baseURL: "https://api.example.com",
  timeout: 8000,
  headers: { Accept: "application/json" },
});

api.configure({ timeout: 5000 });
const isolatedApi = api.create({ baseURL: "https://other.example.com" });
```

نام headerها بدون حساسیت به بزرگی حروف ادغام می‌شوند. مقدار `null` در `headers` یک header پیشین را حذف می‌کند.

### تنظیمات اصلی

| تنظیم               | پیش‌فرض       | شرح                                                                              |
| ------------------- | ------------- | -------------------------------------------------------------------------------- |
| `baseURL`           | `""`          | پیشوند URL برای مسیرهای نسبی                                                     |
| `timeout`           | `12000`       | حداکثر زمان هر تلاش، بر حسب میلی‌ثانیه؛ `0`، `null` و `Infinity` غیرفعال می‌کنند |
| `headers`           | `{}`          | headerهای پیش‌فرض                                                                |
| `responseType`      | `"auto"`      | یکی از `auto`، `json`، `text`، `blob` و `arraybuffer`                            |
| `transport`         | `"auto"`      | یکی از `auto`، `fetch`، `xhr`، `jquery` یا تابع سفارشی                           |
| `allowedOrigins`    | `[]`          | originهای مجاز برای ارسال اعتبارنامه                                             |
| `origin`            | `null`        | origin صفحه؛ در صورت خالی بودن از `location.origin` تشخیص داده می‌شود            |
| `fullResponse`      | `false`       | در صورت فعال بودن، به‌جای `data` کل پاسخ برگردانده می‌شود                        |
| `bustCache`         | `false`       | برای GET/HEAD پارامتر زمان‌دار `_` به URL اضافه می‌کند                           |
| `logLevel`          | `"warn"`      | سطح ثبت رخداد: `debug`، `info`، `warn`، `error` یا `silent`                      |
| `logger`            | `null`        | مقصد سفارشی دارای متدهای `debug`، `info`، `warn`، `error` یا `log`               |
| `xRequestedWith`    | `true`        | برای درخواست‌های trusted، header استاندارد `X-Requested-With` را اضافه می‌کند    |
| `correlationHeader` | `null`        | نام header اختیاری برای ارسال `correlationId`                                    |
| `idempotencyKey`    | تنظیم نمی‌شود | رشته دلخواه یا `true` برای تولید شناسه خودکار درخواست                            |

در حالت `transport: "auto"`، اگر progress درخواست شده باشد XHR انتخاب می‌شود؛ در غیر این صورت Fetch و سپس XHR بر اساس موجودبودن آن‌ها انتخاب می‌شوند. jQuery باید صریحاً با `transport: "jquery"` انتخاب شود. `methodOverride` به‌صورت پیش‌فرض `"header"` است، فقط برای originهای trusted اعمال می‌شود و متدهای پیش‌فرض آن PUT، PATCH و DELETE هستند.

گزینه‌های سازگاری قدیمی `dataType`، `retryCount`، `retryDelay` و `cache` هنوز پذیرفته می‌شوند؛ در کد جدید از `responseType`، `retry.count`، `retry.delay` و `bustCache` استفاده کنید.

برای کنترل رفتار یک درخواست بدون تغییر client، گزینه‌های زیر را به همان درخواست بدهید:

| گزینه                                     | کاربرد                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `signal`                                  | لغو با `AbortController`                                               |
| `abortKey`                                | لغو درخواست قبلی با کلید یکسان                                         |
| `headers`                                 | افزودن header؛ `null` یک header پیش‌فرض را حذف می‌کند                  |
| `contentType`                             | تعیین صریح `Content-Type` بدنه                                         |
| `withAuth` و `token`                      | فعال/غیرفعال‌کردن احراز هویت یا تعیین token همین درخواست               |
| `credentials`                             | تعیین سیاست credentialهای Fetch/XHR                                    |
| `skipRefresh`                             | جلوگیری از تلاش refresh برای این درخواست                               |
| `validateStatus(status)`                  | تعیین statusهایی که پاسخ موفق محسوب می‌شوند                            |
| `onUploadProgress` و `onDownloadProgress` | دریافت رویداد progress از XHR                                          |
| `correlationId`                           | تعیین شناسه این درخواست؛ با `correlationHeader` قابل ارسال به سرور است |

### انواع پاسخ

`responseType: "auto"` بر اساس `Content-Type` پاسخ JSON را parse می‌کند؛ در غیر این صورت متن برمی‌گرداند. `json`، `text`، `blob` و `arraybuffer` نوع پاسخ را صریح می‌کنند. پاسخ‌های 204 و 205 بدون بدنه، `null` دارند.

## احراز هویت و CSRF

تنظیمات احراز هویت در `auth` قرار می‌گیرند:

| تنظیم                 | پیش‌فرض           | شرح                                                  |
| --------------------- | ----------------- | ---------------------------------------------------- |
| `auth.mode`           | `"cookie"`        | روش token: `none`، `cookie`، `memory` یا `storage`   |
| `auth.header`         | `"Authorization"` | نام header توکن                                      |
| `auth.scheme`         | `"Bearer"`        | پیشوند token؛ رشته خالی یعنی ارسال token بدون پیشوند |
| `auth.storage`        | `"local"`         | در حالت storage، یکی از `local` یا `session`         |
| `auth.storageKey`     | `"token"`         | کلید ذخیره token                                     |
| `auth.storageArea`    | `null`            | شیء سفارشی سازگار با Storage                         |
| `auth.getToken`       | `null`            | تابع دریافت token؛ می‌تواند Promise برگرداند         |
| `auth.setToken`       | `null`            | تابع سفارشی ذخیره یا پاک‌کردن token                  |
| `auth.refresh`        | `null`            | تابع async برای دریافت token تازه                    |
| `auth.refreshUrl`     | `null`            | URL جایگزین برای درخواست refresh                     |
| `auth.refreshMethod`  | `"POST"`          | متد درخواست refresh                                  |
| `auth.tokenField`     | `"accessToken"`   | نام فیلد token در پاسخ refresh                       |
| `auth.onUnauthorized` | `null`            | callback پس از خطای 401 و پایان refresh              |

در حالت `memory`، از `setToken`، `getToken` و `clearToken` استفاده کنید:

```js
const api = createClient({
  baseURL: "https://api.example.com",
  auth: { mode: "memory" },
});

api.setToken("ACCESS_TOKEN");
const profile = await api.get("/profile");
api.clearToken();
```

برای غیرفعال‌کردن token در یک درخواست، `withAuth: false` بدهید. برای الزام token در یک درخواست، `withAuth: true` بگذارید. همچنین می‌توانید `token` همان درخواست را مشخص کنید.

وقتی پاسخ 401 دریافت شود، در صورت تنظیم `auth.refresh` یا `auth.refreshUrl`، refresh حداکثر یک بار برای همان درخواست اجرا می‌شود و درخواست اصلی دوباره فرستاده می‌شود. refreshهای هم‌زمان بین درخواست‌ها مشترک می‌شوند. درخواست refresh داخلی، احراز هویت و retry ندارد. پس از شکست refresh، خطای 401 اصلی رد می‌شود و `onUnauthorized` اجرا می‌شود.

در حالت `storage`، token با JavaScript قابل خواندن است و در برابر XSS محافظت نمی‌شود. برای token حساس، storage را تنها با آگاهی از این ریسک انتخاب کنید.

برای CSRF از تنظیمات `csrf` استفاده کنید. نام پیش‌فرض cookie برابر `XSRF-TOKEN`، header برابر `X-XSRF-TOKEN` و meta برابر `csrf-token` است. در درخواست‌های غیرایمن، token ابتدا از cookie و سپس از meta خوانده می‌شود. این قابلیت فقط در محیط دارای `document` قابل استفاده است.

### Origin و اعتبارنامه

BaseAjax فقط URLهای HTTP و HTTPS را می‌پذیرد. origin صفحه و origin `baseURL` trusted هستند؛ برای مقصدهای دیگر آن‌ها را در `allowedOrigins` وارد کنید. اگر مقصد trusted نباشد، ارسال صریح `token` یا `withAuth: true` با خطای `UNTRUSTED_ORIGIN` رد می‌شود. credential پیش‌فرض برای مقصد trusted برابر `include` و برای مقصد دیگر `omit` است؛ می‌توانید `credentials` را در تنظیمات درخواست تعیین کنید.

## تلاش مجدد و لغو درخواست

`retry` می‌تواند شیء سیاست یا مقدار عددی تعداد retry باشد. مقدار `false` آن را خاموش می‌کند.

| گزینه               | پیش‌فرض                                         | شرح                                      |
| ------------------- | ----------------------------------------------- | ---------------------------------------- |
| `count`             | `0`                                             | تعداد تلاش‌های مجدد بعد از درخواست اول   |
| `delay`             | `1000`                                          | تأخیر اولیه بر حسب میلی‌ثانیه            |
| `maxDelay`          | `30000`                                         | بیشینه تأخیر backoff                     |
| `factor`            | `2`                                             | ضریب افزایش تأخیر                        |
| `jitter`            | `true`                                          | تصادفی‌سازی تأخیر برای پخش درخواست‌ها    |
| `methods`           | `GET`، `HEAD`، `OPTIONS`                        | متدهای قابل retry بدون idempotency key   |
| `statuses`          | `408`، `425`، `429`، `500`، `502`، `503`، `504` | statusهای HTTP قابل retry                |
| `onTimeout`         | `true`                                          | retry در timeout                         |
| `onNetworkError`    | `true`                                          | retry در خطای شبکه                       |
| `respectRetryAfter` | `true`                                          | رعایت header پاسخ `Retry-After`          |
| `maxRetryAfter`     | `60000`                                         | بیشینه زمان پذیرفته‌شده از `Retry-After` |

درخواست فقط زمانی retry می‌شود که نوع خطا و متد با سیاست سازگار باشند. برای retry متدهای دیگر، `idempotencyKey` تنظیم کنید. `timeout` برای هر تلاش جداگانه محاسبه می‌شود.

برای لغو، `signal` از `AbortController` بدهید. `abortKey` نیز درخواست قبلی دارای همان کلید را لغو می‌کند:

```js
const controller = new AbortController();
const pending = api.get("/large-report", undefined, {
  signal: controller.signal,
});
controller.abort();

// درخواست بعدی با همان abortKey درخواست قبلی را لغو می‌کند.
api.get("/search", { q: "first" }, { abortKey: "search" });
api.get("/search", { q: "second" }, { abortKey: "search" });
```

## پاسخ‌ها و خطاها

به‌طور پیش‌فرض، متدها فقط `response.data` را برمی‌گردانند. برای دریافت status و headerها، `fullResponse: true` تنظیم کنید:

```js
const response = await api.get("/users", undefined, { fullResponse: true });
console.log(
  response.data,
  response.status,
  response.headers,
  response.attempts,
);
```

پاسخ کامل شامل `data`، `status`، `statusText`، `headers`، `url`، `method`، `correlationId` و `attempts` است.

خطاهای کتابخانه از نوع `ApiError` هستند. فیلدهای اصلی آن `code`، `status`، `statusText`، `data`، `headers`، `url`، `method`، `correlationId`، `attempts` و `cause` هستند. `response` نام مستعار قدیمی `data` است.

برای تشخیص خطا از `isApiError(error)` یا `error instanceof ApiError` استفاده کنید. ویژگی‌های کمکی `isHttp`، `isTimeout`، `isNetwork` و `isAborted` نوع خطا را مشخص می‌کنند. `toJSON()` خلاصه‌ای از خطا برمی‌گرداند و بدنه پاسخ را در خروجی قرار نمی‌دهد.

کدهای خطا:

| کد                 | معنا                                                |
| ------------------ | --------------------------------------------------- |
| `HTTP_ERROR`       | status پاسخ با `validateStatus` پذیرفته نشده است    |
| `TIMEOUT`          | زمان درخواست تمام شده است                           |
| `NETWORK_ERROR`    | خطای ارتباط با transport                            |
| `ABORTED`          | درخواست توسط کاربر یا `abortKey` لغو شده است        |
| `PARSE_ERROR`      | بدنه پاسخ JSON معتبر نیست                           |
| `INVALID_REQUEST`  | تنظیمات، URL، transport یا بدنه درخواست نامعتبر است |
| `UNTRUSTED_ORIGIN` | ارسال اعتبارنامه به origin غیرمجاز درخواست شده است  |

برای تغییر معیار پذیرش status از `validateStatus(status)` استفاده کنید. مقدار پیش‌فرض statusهای 200 تا 299 را می‌پذیرد.

```js
try {
  await api.get("/users/404");
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.code, error.status, error.data);
  }
}
```

## Interceptorها و ثبت رخداد

هر stack متدهای `use(fn)`، `eject(id)`، `clear()` و `list()` دارد:

```js
api.interceptors.request.use((config) => ({
  ...config,
  headers: { ...config.headers, "X-App-Version": "2" },
}));

api.interceptors.response.use((response) => {
  response.data.receivedAt = Date.now();
  return response;
});

api.interceptors.error.use((error) => {
  if (error.status === 404) return null; // بازیابی خطا با مقدار دلخواه
});
```

Interceptor درخواست config را می‌گیرد؛ با برگرداندن config، درخواست را تغییر می‌دهد. Interceptor پاسخ شیء پاسخ کامل را می‌گیرد و می‌تواند نسخه تغییر‌یافته آن را برگرداند. Interceptor خطا می‌تواند یک `Error` جدید برگرداند یا خطا را با مقدار دیگری بازیابی کند. اگر `undefined` برگرداند، پردازش خطا ادامه می‌یابد.

رخدادها به‌شکل JSON ساخت‌یافته ثبت می‌شوند. سطح پیش‌فرض `warn` است. کلیدهایی مانند password، token، secret، authorization، api key، cookie و credential در metadata پاک‌سازی می‌شوند؛ پارامترهای حساس URL نیز پوشانده می‌شوند. این پاک‌سازی جایگزین حذف اطلاعات حساس از داده‌های خود برنامه نیست.

## Transport سفارشی

تابع transport باید یک Promise از شیء پاسخ خام برگرداند. statusهای HTTP باید resolve شوند؛ فقط خطای شبکه یا لغو باید reject شود.

```js
const api = createClient({
  baseURL: "https://api.example.com",
  transport: async (request) => {
    // request شامل url، method، headers، body، credentials، signal و responseType است.
    return {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  },
});
```

Transport jQuery برای پاسخ‌های `blob` و `arraybuffer` پشتیبانی نمی‌شود. برای progress بارگذاری یا دریافت، از XHR استفاده کنید؛ در حالت `auto`، وجود callbackهای progress باعث انتخاب XHR می‌شود.

## پلاگین‌ها

پلاگین‌ها جداگانه از `base-ajax/plugins` وارد می‌شوند. هر پلاگین یک client جدید می‌سازد و client اصلی را تغییر نمی‌دهد.

### Cache

`cache(client, options)` پاسخ متدهای مشخص را در حافظه نگه می‌دارد. پیش‌فرض فقط GET را cache می‌کند و TTL برابر ۶۰ ثانیه است. `staleWhileRevalidate: true` داده منقضی‌شده را فوراً برمی‌گرداند و به‌روزرسانی را در پس‌زمینه انجام می‌دهد.

```js
const cachedApi = cache(api, { ttl: 30_000, staleWhileRevalidate: true });
await cachedApi.get("/users");
cachedApi.cache.clear();
```

گزینه‌های دیگر: `methods`، `keyFn(config)` و `store` از نوع `Map`. handle به نام `cache` متدهای `clear`، `delete`، `has`، `get`، `size`، `keys` و `key` دارد. پاسخ‌ها با reference مشترک نگهداری می‌شوند؛ اگر مصرف‌کننده آن‌ها را تغییر دهد، مقدار cache نیز تغییر می‌کند. Cache به‌تنهایی missهای هم‌زمان را ادغام نمی‌کند؛ برای آن `dedupe` را هم اضافه کنید.

### Dedupe

`dedupe(client, options)` درخواست‌های هم‌زمان با کلید یکسان را در یک Promise مشترک ادغام می‌کند. پیش‌فرض متدهای GET و HEAD را بررسی می‌کند. درخواست‌های بعدی پس از پایان درخواست قبلی دوباره به شبکه می‌روند.

```js
const dedupedApi = dedupe(api);
const [a, b] = await Promise.all([
  dedupedApi.get("/users"),
  dedupedApi.get("/users"),
]);
```

گزینه‌ها: `methods` و `keyFn(config)`. مقدار `inflightSize` تعداد کلیدهای در حال اجرا را نشان می‌دهد.

### Queue

`queue(client, options)` تعداد درخواست‌های هم‌زمان را محدود می‌کند. پیش‌فرض `maxConcurrent` برابر ۶ است. درخواست‌های دارای `priority` بالاتر زودتر از صف اجرا می‌شوند؛ پیش‌فرض اولویت صفر است.

```js
const queuedApi = queue(api, { maxConcurrent: 4 });
queuedApi.get("/urgent", undefined, { priority: 10 });
console.log(queuedApi.queue.active, queuedApi.queue.pending);
```

`priority` فقط hint پلاگین است و پیش از رسیدن درخواست به هسته حذف می‌شود. handle به نام `queue` مقادیر `active`، `pending` و `maxConcurrent` را ارائه می‌دهد.

### Circuit breaker

`circuitBreaker(client, options)` پس از رسیدن تعداد خطاهای متوالی به آستانه، درخواست‌ها را موقتاً رد می‌کند. حالت‌ها `closed`، `open` و `half-open` هستند. پیش‌فرض‌ها: `failureThreshold: 5`، `successThreshold: 2` و `cooldownMs: 30000`.

```js
const resilientApi = circuitBreaker(api, {
  failureThreshold: 5,
  cooldownMs: 15_000,
});
console.log(resilientApi.circuitBreaker.getState());
```

گزینه `shouldCount(error)` تعیین می‌کند کدام خطاها شمرده شوند؛ حالت پیش‌فرض خطاهای لغوشده را نادیده می‌گیرد. callbackهای `onOpen`، `onHalfOpen` و `onClose` برای آگاه‌شدن از تغییر حالت هستند. handle متدهای `getState`، `getStats` و `reset` دارد. هنگام بازبودن مدار، خطای `CircuitOpenError` رد می‌شود.

### Trace

`trace(client, options)` header مربوط به W3C Trace Context را به درخواست اضافه می‌کند. نام پیش‌فرض header برابر `traceparent` است. اگر caller از قبل آن header را داده باشد، پلاگین آن را بازنویسی نمی‌کند.

```js
const tracedApi = trace(api, {
  onTrace: (value) => console.debug(value),
});
```

گزینه‌ها: `headerName`، `getTraceparent()` برای تأمین مقدار upstream، `onTrace(value)`، `validate` و `onInvalid(value)`. تابع `generateTraceparent()` نیز مقدار جدید با قالب W3C تولید می‌کند. اعتبارسنجی پیش‌فرض فقط callback اختیاری `onInvalid` را فراخوانی می‌کند و درخواست را متوقف نمی‌کند.

### Mock

`mock(handlers)` یک transport آزمایشی می‌سازد. هر handler شامل `match` و `response` است. `match` می‌تواند URL دقیق، رشته `"METHOD URL"`، RegExp یا تابع `(request) => boolean` باشد. `response` می‌تواند شیء پاسخ یا تابع همگام/ناهمگام باشد.

```js
const testApi = createClient({
  origin: "https://test.example",
  transport: mock([
    {
      match: "GET https://test.example/users",
      response: { body: [{ id: 1 }] },
    },
    {
      match: /\/users\/\d+$/,
      response: (request) => ({ body: { url: request.url } }),
    },
  ]),
});
```

اگر status مشخص نشود، مقدار 200 استفاده می‌شود. header پیش‌فرض `Content-Type` برابر `application/json` است. route پیدا‌نشده پاسخ خام 404 می‌دهد که با `validateStatus` پیش‌فرض به خطای `HTTP_ERROR` تبدیل می‌شود.

### ترکیب پلاگین‌ها

`compose(client, ...plugins)` پلاگین‌ها را از چپ به راست اعمال می‌کند. پلاگین اول بیرونی‌ترین لایه است؛ بنابراین ترتیب می‌تواند رفتار و محدوده اثر هر پلاگین را تغییر دهد.

```js
const enhancedApi = compose(
  api,
  (client) => queue(client, { maxConcurrent: 4 }),
  (client) => dedupe(client),
  (client) => cache(client, { ttl: 30_000 }),
  (client) => circuitBreaker(client, { failureThreshold: 5 }),
  (client) => trace(client),
);
```

## ساخت و بررسی پروژه

برای ساخت خروجی‌ها:

```bash
npm run build
```

Rollup هسته و پلاگین‌ها را جداگانه می‌سازد و علاوه بر آن، خروجی ترکیبی ESM، CommonJS و UMD تولید می‌کند. فایل `dist/baseAjax.all.umd.min.js` نسخه‌ی فشرده و مستقل برای بارگذاری یک‌فایلی در مرورگر است. Source mapها هم تولید می‌شوند.

فرمان‌های توسعه:

| فرمان                    | کاربرد                                                  |
| ------------------------ | ------------------------------------------------------- |
| `npm test`               | اجرای همه تست‌های Vitest                                |
| `npm run test:browser`   | ساخت و آزمون bundle ترکیبی در محیط مرورگر شبیه‌سازی‌شده |
| `npm run test:watch`     | اجرای Vitest در حالت watch                              |
| `npm run test:coverage`  | اجرای تست‌ها همراه پوشش کد                              |
| `npm run test:property`  | اجرای تست‌های property در `tests/property`              |
| `npm run test:types`     | بررسی تست‌های نوع TypeScript                            |
| `npm run typecheck`      | بررسی نوع فایل‌های پروژه با TypeScript                  |
| `npm run verify:exports` | بررسی مسیر `base-ajax/all` در ESM و CommonJS (پس از build) |
| `npm run verify`         | اجرای typecheck، تست‌های نوع و پوشش، build و بررسی exportها |
| `npm run bench`          | ساخت خروجی و اجرای benchmark هسته                       |
| `npm run serve:examples` | اجرای سرور محلی مثال‌ها روی پورت 5173                   |

برای جزئیات API و نوع‌ها به [تعریف‌های BaseAjax](types/baseAjax.d.ts) و [تعریف‌های پلاگین‌ها](types/plugins.d.ts) مراجعه کنید.
