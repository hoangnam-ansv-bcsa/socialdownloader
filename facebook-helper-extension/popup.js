const backendUrlInput =
  document.getElementById("backendUrl");

const helperKeyInput =
  document.getElementById("helperKey");

const saveButton =
  document.getElementById("saveButton");

const sendButton =
  document.getElementById("sendButton");

const statusBox =
  document.getElementById("status");

function showStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = type;
}

async function loadSettings() {
  const settings = await chrome.storage.local.get([
    "backendUrl",
    "helperKey",
  ]);

  backendUrlInput.value =
    settings.backendUrl || "";

  helperKeyInput.value =
    settings.helperKey || "";
}

async function saveSettings() {
  const backendUrl =
    backendUrlInput.value
      .trim()
      .replace(/\/+$/, "");

  const helperKey =
    helperKeyInput.value.trim();

  if (!backendUrl) {
    throw new Error(
      "Bạn chưa nhập địa chỉ backend.",
    );
  }

  if (!helperKey) {
    throw new Error(
      "Bạn chưa nhập mã ghép nối.",
    );
  }

  await chrome.storage.local.set({
    backendUrl,
    helperKey,
  });
}

saveButton.addEventListener(
  "click",
  async () => {
    saveButton.disabled = true;

    try {
      await saveSettings();

      showStatus(
        "Đã lưu cấu hình trong Chrome.",
        "success",
      );
    } catch (error) {
      showStatus(
        error.message || "Không thể lưu cấu hình.",
        "error",
      );
    } finally {
      saveButton.disabled = false;
    }
  },
);

sendButton.addEventListener(
  "click",
  async () => {
    sendButton.disabled = true;
    saveButton.disabled = true;

    showStatus(
      "Đang gửi phiên Facebook...",
    );

    try {
      await saveSettings();

      const result =
        await chrome.runtime.sendMessage({
          type: "SEND_FB_SESSION",
        });

      if (!result?.success) {
        throw new Error(
          result?.error ||
            "Không thể gửi phiên Facebook.",
        );
      }

      showStatus(
        `Đã gửi thành công ${result.cookieCount} cookie.`,
        "success",
      );
    } catch (error) {
      showStatus(
        error.message ||
          "Không thể gửi phiên Facebook.",
        "error",
      );
    } finally {
      sendButton.disabled = false;
      saveButton.disabled = false;
    }
  },
);

loadSettings().catch(() => {
  showStatus(
    "Không thể đọc cấu hình đã lưu.",
    "error",
  );
});
