async function getFacebookCookies() {
  const cookies = await chrome.cookies.getAll({
    domain: ".facebook.com",
  });

  const cookieNames = new Set(
    cookies.map((cookie) => cookie.name),
  );

  if (
    !cookieNames.has("c_user") ||
    !cookieNames.has("xs")
  ) {
    throw new Error(
      "Chrome chưa có phiên Facebook hợp lệ.",
    );
  }

  return cookies;
}

async function sendFacebookSession() {
  const settings = await chrome.storage.local.get([
    "backendUrl",
    "helperKey",
  ]);

  const backendUrl =
    typeof settings.backendUrl === "string"
      ? settings.backendUrl.trim().replace(/\/+$/, "")
      : "";

  const helperKey =
    typeof settings.helperKey === "string"
      ? settings.helperKey.trim()
      : "";

  if (!backendUrl) {
    throw new Error(
      "Chưa nhập địa chỉ backend.",
    );
  }

  if (!helperKey) {
    throw new Error(
      "Chưa nhập mã ghép nối.",
    );
  }

  const cookies = await getFacebookCookies();

  const response = await fetch(
    `${backendUrl}/api/facebook/session`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-facebook-helper-key": helperKey,
      },
      body: JSON.stringify({
        cookies,
        userAgent: navigator.userAgent,
      }),
    },
  );

  let result;

  try {
    result = await response.json();
  } catch {
    result = {};
  }

  if (!response.ok) {
    throw new Error(
      result.error ||
        `Backend trả về lỗi HTTP ${response.status}.`,
    );
  }

  return {
    success: true,
    cookieCount: result.cookieCount || cookies.length,
    receivedAt: result.receivedAt || Date.now(),
  };
}

chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {
    if (message?.type !== "SEND_FB_SESSION") {
      return false;
    }

    sendFacebookSession()
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Không thể gửi phiên Facebook.",
        });
      });

    return true;
  },
);
