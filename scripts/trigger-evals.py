#!/usr/bin/env python3
"""Measure how reliably each skill's description triggers.

    cd <a disposable directory>            # see WARNING
    python3 scripts/trigger-evals.py evals/trigger-corpus.json train 3

WARNING - this spawns real agent runs that CAN write to disk.
`--allowedTools` and `--disallowedTools` do NOT block tool execution in `claude -p`; they only
govern approval. What keeps a run harmless is that this script kills it at the first tool call,
and Skill is invoked first when it is invoked at all. That is a mitigation, not a sandbox, so
always run from a throwaway directory - never from a real repository. A run that completed
before this safeguard existed once edited a live website checkout.

MODEL - always --model opus. The CLI default resolved to claude-fable-5-1, which behaves very
differently: a set of descriptions scoring 28/38 on Fable scored 17/38 on Opus. Measuring the
wrong model tells you nothing about what ships.

THROTTLING - a rate-limited run yields assistant text but no tool call, which is indistinguishable
from a genuine non-trigger. Runs are checked for rate_limit_info.status != "allowed" and retried.
Note that overageStatus "rejected" / out_of_credits is account configuration, not throttling.

Reads train or validation out of the corpus. Scores three runs per query; a positive passes above
a 0.5 trigger rate, a negative at or below. Guide changes with train, choose between candidates
with validation, and append the result to evals/trigger-runs.json with the model recorded.
"""
import json, subprocess, sys, time, concurrent.futures as cf
# Skill is invoked FIRST when it is invoked at all (verified), so killing at the first tool_use
# both decides the outcome and stops the run before it can act. cwd must be a disposable fixture:
# --allowedTools / --disallowedTools do NOT block execution in -p mode.
BASE=["claude","-p","--model","opus","--output-format","stream-json","--verbose"]
def once(q):
    p=subprocess.Popen(BASE+[q],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,
                       stderr=subprocess.DEVNULL,text=True,bufsize=1)
    got=None; decided=False; throttled=False; done=False
    try:
        for line in p.stdout:
            if '"rate_limit_event"' in line:
                try:
                    info=json.loads(line).get("rate_limit_info") or {}
                    if info.get("status") not in (None,"allowed"): throttled=True
                except Exception: pass
            if '"type":"result"' in line: done=True
            if '"tool_use"' in line:
                try: ev=json.loads(line)
                except Exception: continue
                for b in (ev.get("message") or {}).get("content") or []:
                    if isinstance(b,dict) and b.get("type")=="tool_use":
                        if b.get("name")=="Skill":
                            s=(b.get("input") or {}).get("skill","")
                            if s.startswith("kademi:"): got=s.split(":",1)[1]
                        decided=True; raise StopIteration
    except StopIteration: pass
    finally: p.kill(); p.wait()
    return got,(decided or done) and not throttled
def main(path,runs=3,workers=3):
    qs=json.load(open(path))
    def one(q):
        hits=[]
        for _ in range(runs):
            for a in range(3):
                g,ok=once(q["query"])
                if ok: hits.append(g); break
                time.sleep(5+8*a)
            else: hits.append("ERROR")
        val=[h for h in hits if h!="ERROR"]
        r=(sum(1 for h in val if h==q["skill"])/len(val)) if val else 0.0
        return {**q,"hits":hits,"errors":hits.count("ERROR"),"rate":r,
                "pass":(r>0.5) if q["should_trigger"] else (r<=0.5)}
    res=[]
    with cf.ThreadPoolExecutor(workers) as ex:
        for i,r in enumerate(ex.map(one,qs),1):
            res.append(r); print(f"[{i}/{len(qs)}] {'ok ' if r['pass'] else 'FAIL'} {r['rate']:.2f} {r['skill']:20} {r['query'][:40]}", flush=True)
    json.dump(res,open(path.replace(".json","-results.json"),"w"),indent=1)
    for r in res:
        if not r["pass"]: print(f"  FAIL {r['rate']:.2f} {r['skill']:21} {[h or '-' for h in r['hits']]}  {r['query'][:46]}")
    print(f"\n{sum(1 for r in res if r['pass'])}/{len(res)} pass  ({sum(r['errors'] for r in res)} errored)")
if __name__=="__main__":
    import tempfile, os
    corpus=json.load(open(sys.argv[1])); split=sys.argv[2] if len(sys.argv)>2 else "train"
    runs=int(sys.argv[3]) if len(sys.argv)>3 else 3
    fd,tmp=tempfile.mkstemp(suffix=".json"); json.dump(corpus[split],open(tmp,"w"))
    print(f"{split}: {len(corpus[split])} queries x {runs} runs, model opus")
    main(tmp,runs); os.close(fd)
