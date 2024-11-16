import * as child_process from "child_process";
import * as path from "path";
import { workspace, ExtensionContext, window, OutputChannel, commands } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  State,
} from "vscode-languageclient/node";

let client: LanguageClient;
let outputChannel: OutputChannel;

export function activate(context: ExtensionContext) {
  try {
    outputChannel = window.createOutputChannel("Next Language Server");
    outputChannel.appendLine("Next Language Server is now active!");
    outputChannel.show();

    const config = workspace.getConfiguration("nextls");
    let executablePath = config.get<string>("executablePath", "nextls");

    // Adjust the PATH to include $HOME/bin
    const env = { ...process.env };
    const homeBin = path.join(process.env.HOME || "", "bin");
    env.PATH = `${homeBin}${path.delimiter}${env.PATH}`;

    // Resolve the full path to the executable
    if (!path.isAbsolute(executablePath)) {
      executablePath = whichSync(executablePath, { path: env.PATH }) || executablePath;
    }

    const serverOptions: ServerOptions = {
      command: executablePath,
      args: [],
      options: { env },
    };

    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { scheme: "file", language: "next" },
        { scheme: "file", language: "npl" },
      ],
      synchronize: {
        fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
      },
      outputChannel,
    };

    outputChannel.appendLine("Creating language client...");

    client = new LanguageClient(
      "nextLanguageServer",
      "Next Language Server",
      serverOptions,
      clientOptions
    );

    outputChannel.appendLine("Starting language client...");
    outputChannel.show();

    const disposable = client.start();

    outputChannel.appendLine(
      "Language client started, waiting for ready event..."
    );
    outputChannel.show();

    client.onReady().then(() => {
      outputChannel.appendLine("Language server is ready.");
      outputChannel.appendLine("Server capabilities:");
      outputChannel.appendLine(
        JSON.stringify(client.initializeResult?.capabilities, null, 2)
      );
      outputChannel.appendLine("Adding event listeners...");

      client.onDidChangeState((e) => {
        outputChannel.appendLine(
          `Client state changed from ${State[e.oldState]} to ${State[e.newState]}`
        );
      });

      client.onNotification("window/logMessage", (params) => {
        outputChannel.appendLine(`Server log: ${params.message}`);
      });
    }).catch((reason) => {
      outputChannel.appendLine(`Failed to start language client: ${reason}`);
    });

    outputChannel.appendLine("Adding disposable to context.subscriptions");
    context.subscriptions.push(disposable);
    outputChannel.appendLine("Next Language Server activation completed");

    // Handle extension deactivation
    context.subscriptions.push({
      dispose: () => {
        outputChannel.appendLine("Extension is being deactivated.");
        if (client) {
          client.stop();
        }
      },
    });
  } catch (error) {
    outputChannel.appendLine(`Error: ${error}`);
    outputChannel.show();
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

// Helper function to find the executable
function whichSync(cmd: string, opts: { path: string }): string | null {
  const paths = opts.path.split(path.delimiter);
  for (const p of paths) {
    const fullPath = path.join(p, cmd);
    if (process.platform === "win32") {
      if ([".exe", ".cmd", ".bat"].some(ext => fs.existsSync(fullPath + ext))) {
        return fullPath;
      }
    } else if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

