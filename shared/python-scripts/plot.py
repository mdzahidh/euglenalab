import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import json
import sys

plt.style.use('ggplot')
with open(sys.argv[1],"r") as f:
    data = json.load(f)

    plt.figure()
    plt.plot(data["x"],data["y"])

    if( "xlabel" in data):
        plt.xlabel(data["xlabel"])

    if( "ylabel" in data):
        plt.ylabel(data["ylabel"])


    if( "xlim" in data ):
        plt.xlim(data["xlim"])

    if( "ylim" in data ):
        plt.ylim(data["ylim"])

    if( "title" in data):
        plt.title(data["title"])

    output = "plot.svg" if "output" not in data else data["output"]
    dpi = 300 if "dpi" not in data else int(data["dpi"])

    plt.savefig(output,dpi=300)
