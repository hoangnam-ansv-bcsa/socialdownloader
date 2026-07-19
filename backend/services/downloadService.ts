import { execa } from "execa";

export async function downloadVideo(
    url: string,
    onOutput?: (line: string) => void
) {

    const subprocess = execa("yt-dlp", [
        "-o",
        "downloads/%(title)s.%(ext)s",
        url
    ]);

    subprocess.stdout?.on("data", (data) => {
        const line = data.toString();

        if (onOutput) {
            onOutput(line);
        }
    });

    await subprocess;

    return true;
}