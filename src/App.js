import React, { useState, useRef, useEffect, useLayoutEffect, Fragment } from 'react';
import { Container, Typography, Box, Link, Card, Grid, CardHeader, CardContent, TextField, InputAdornment, Button, Dialog, DialogActions, DialogContent, DialogTitle, CssBaseline } from '@mui/material';
import ProTip from './ProTip';
import AoConnect from './AoConnect.js';
import { ConnectButton, useActiveAddress, ArweaveWalletKit } from 'arweave-wallet-kit';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Readline } from 'xterm-readline';
import 'xterm/css/xterm.css';

function Copyright() {
  return (
    <Typography variant="body2" color="text.secondary" align="center">
      {'Copyright © '}
      <Link color="inherit" href="https://mui.com/">
        Your Website
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

export default function App() {
  const [processName, setProcessName] = useState("default");
  const [connecting, setConnecting] = useState(false);
  const [connectProcessId, setConnectProcessId] = useState("");
  const [contentedAddress, setContentedAddress] = useState("");
  const [loadText, setLoadText] = useState("");
  const activeAddress = useActiveAddress();

  useEffect(() => {
    queryAllProcesses(activeAddress);
    setContentedAddress(activeAddress);
  }, [activeAddress]);

  const spawnProcess = () => {
    if (window.arweaveWallet && processName) {
      outPutMsg(`Create ${processName} Process ...`, false);
      const tags = [
        { name: "App-Name", value: "aos" },
        { name: "aos-Version", value: "1.10.30" },
        { name: "Name", value: processName },
      ];
      AoConnect.AoCreateProcess(window.arweaveWallet, AoConnect.DEFAULT_MODULE, AoConnect.DEFAULT_SCHEDULER, tags).then(processId => {
        setConnectProcessId(processId);
        doLive(processId);
        outPutMsg(`create success, connect success pid：${processId}`);
        setConnecting(false);
      });
    }
  };

  const queryAllProcesses = (address) => {
    if (address && contentedAddress === address) {
      if (processName.length === 43) {
        const processId = processName;
        setConnectProcessId(processId);
        doLive(processId);
      } else {
        AoConnect.AoQueryProcesses(address, processName).then(processInfoList => {
          console.info(processInfoList);
          if (processInfoList && processInfoList.length > 0) {
            const processId = processInfoList[0].id;
            setConnectProcessId(processId);
            doLive(processId);
            outPutMsg(`connect success pid：${processId}`);
            setConnecting(false);
          } else {
            spawnProcess();
          }
        });
      }
    }
  };

  const createOrConnect = () => {
    if (activeAddress) {
      outPutMsg(`Connect Process ...`, false);
      setConnecting(true);
      queryAllProcesses(activeAddress);
    } else {
      outPutMsg(`Connect Wallet First`, true);
    }
  };

  const handleProcessNameChange = (event) => {
    setProcessName(event.target.value);
  };

  const terminalRef = useRef(null);
  const [xterm, setXterm] = useState(null);
  const [outLine, setOutLine] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  useLayoutEffect(() => {
    const fitAddon = new FitAddon();
    const terminal = new Terminal();
    setXterm(terminal);
    const rl = new Readline();

    terminal.loadAddon(rl);
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();
    terminal.focus();
    terminal.writeln("Welcome to aos" + "\r\n");

    rl.setCheckHandler((text) => {
      let trimmedText = text.trimEnd();
      if (trimmedText.endsWith("&&")) {
        return false;
      }
      return true;
    });
    setOutLine(rl);

    return () => {
      terminal.dispose();
    };
  }, []);

  useEffect(() => {
    if (outLine) {
      outLine.read("aos> ").then(processLine);
    }
  }, [outLine, connectProcessId]);

  useEffect(() => {
    if (loadText) {
      doLoad();
    }
  }, [loadText]);

  function readLine() {
    if (outLine) {
      outLine.read("aos> ").then(processLine);
    }
  }

  function outPutMsg(msg, withAos = true) {
    xterm.writeln(`\r${msg}`);
    if (withAos) {
      xterm.write("aos> ");
    }
  }

  async function processLine(text) {
    if (text.trim().length === 0) {
      setTimeout(readLine);
      return;
    }
    const loadBlueprintExp = /\.load-blueprint\s+(\w*)/;
    if (loadBlueprintExp.test(text)) {
      const bpName = text.match(/\.load-blueprint\s+(\w*)/)[1];
      text = await loadBlueprint(bpName);
      outLine.println("loading " + bpName + "...");
    }
    const loadExp = /\.load/;
    if (loadExp.test(text)) {
      setShowEditor(true);
      return;
    }
    if (/\.editor/.test(text)) {
      setShowEditor(true);
      return;
    }
    if (connectProcessId.length === 43) {
      try {
        const result = await AoConnect.evaluate(connectProcessId, text);
        outLine.println(result);
      } catch (e) {
        xterm.writeln("ERROR: " + e.message);
      }
    } else {
      xterm.writeln("Connect to a process to get started.");
    }
    setTimeout(readLine);
  }

  async function loadBlueprint(name) {
    const data = await fetch(`https://raw.githubusercontent.com/permaweb/aos/main/blueprints/${name}.lua`)
      .then(res => {
        if (res.status === 200) {
          return res.text();
        }
        throw new Error("blueprint not found");
      });
    return data;
  }

  async function doLoad() {
    try {
      if (connectProcessId && loadText) {
        outLine.println("load code...");
        const result = await AoConnect.evaluate(connectProcessId, loadText);
        outLine.println(result);
        setLoadText("");
        setShowEditor(false);
        setTimeout(readLine);
      }
    } catch (e) {
      xterm.writeln("ERROR: " + e.message);
    }
  }

  const handleClickOpen = () => {
    setShowEditor(true);
  };

  const handleClose = () => {
    setShowEditor(false);
  };

  const [cursor, setCursor] = useState("");
  const [liveMsg, setLiveMsg] = useState(null);
  async function live(pid) {
    let results = await AoConnect.connect().results({
      process: pid,
      sort: "DESC",
      from: cursor || "",
      limit: 1,
    });
    const xnode = results.edges.filter(
      x => x.node.Output.print === true
    )[0];
    if (xnode) {
      setCursor(xnode.cursor);
      return xnode.node.Output.data;
    }
    return null;
  }

  async function doLive(pid) {
    const getLiveUpdates = async () => {
      const msg = await live(pid);
      if (msg !== null && msg !== liveMsg) {
        setLiveMsg(msg);
      }
      setTimeout(getLiveUpdates, 5000);
    };
    setTimeout(getLiveUpdates, 500);
  }

  useEffect(() => {
    if (liveMsg) {
      liveMsg.split("\n").forEach((m) => xterm.writeln("\r" + m));
      xterm.write("aos> ");
    }
  }, [liveMsg]);

  return (
    <ArweaveWalletKit
      config={{
        permissions: ["ACCESS_ADDRESS", "SIGN_TRANSACTION"],
        ensurePermissions: true,
      }}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container maxWidth="lg">
          <Typography variant="h3" component="h1" gutterBottom>
            Enhanced AOConnect
          </Typography>
          <Box sx={{ my: 4 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardHeader title="Process Manager" />
                  <CardContent>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs>
                        <TextField
                          fullWidth
                          label="Process Name"
                          placeholder="Enter Process Name"
                          value={processName}
                          onChange={handleProcessNameChange}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position='start'>
                                {/* Add an icon if needed */}
                              </InputAdornment>
                            )
                          }}
                          error={false}
                        />
                      </Grid>
                      <Grid item>
                        <Button
                          type='submit'
                          variant='contained'
                          size='large'
                          onClick={createOrConnect}
                          disabled={!processName || connecting}
                        >
                          Create or Connect
                        </Button>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <div ref={terminalRef} style={{ width: '100%', height: '300px' }} />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
          <ProTip />
          <Copyright />
        </Container>
      </ThemeProvider>
    </ArweaveWalletKit>
  );
}
