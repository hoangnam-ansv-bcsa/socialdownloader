import { execa } from "execa";

export interface DownloadOptions {
    output:string;
}

export async function runYtDlp(
    url:string,
    options:DownloadOptions,
    onProgress?:(line:string)=>void
){

    const subprocess = execa("yt-dlp",[
        "-o",
        options.output,
        "--newline",
        url
    ]);

    subprocess.stdout?.on("data",(data)=>{

        const line=data.toString();

        if(onProgress){

            onProgress(line);

        }

    });

    subprocess.stderr?.on("data",(data)=>{

        const line=data.toString();

        if(onProgress){

            onProgress(line);

        }

    });

    await subprocess;

}