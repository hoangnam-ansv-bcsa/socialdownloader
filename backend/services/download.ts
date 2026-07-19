import { runYtDlp } from "./ytDlp";

export async function download(taskUrl: string) {

    await runYtDlp(

        taskUrl,

        {
            output: "downloads/%(title)s.%(ext)s"
        }

    );

}