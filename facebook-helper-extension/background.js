chrome.runtime.onMessage.addListener(
  async (message) => {

    if (message.type !== "GET_FB_COOKIE") {
      return;
    }

    const cookies =
      await chrome.cookies.getAll({
        domain: ".facebook.com"
      });

    console.log(
      "Facebook cookies:",
      cookies
    );
  }
);
