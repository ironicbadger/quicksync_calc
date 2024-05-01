from io import StringIO
import requests
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
import time
import os
import pickle


GIST_ID = "5da9b321acbe6b6b53070437023b844d"


def get_comments(fname='comments.pkl'):
    if os.path.exists(fname):
        with open(fname, 'rb') as fh:
            comments = pickle.load(fh)
    else:
        comments = []
        page = 1
        while True:
            r = requests.get(f"https://api.github.com/gists/{GIST_ID}/comments",
                             params={"page": page})
            r.raise_for_status()
            r = r.json()
            comments += r
            if len(r) != 30:
                break
            page += 1
            time.sleep(1)
        with open(fname, 'wb') as fh:
            pickle.dump(comments, fh)
    return comments


def extract_results(comments, expected_cols=None):
    if expected_cols is None:
        expected_cols = ['CPU', 'TEST', 'FILE', 'BITRATE', 'TIME', 'AVG_FPS',
                         'AVG_SPEED', 'AVG_WATTS', 'user']
    dfs = []
    for comment in comments:
        lines = comment['body'].splitlines()
        for i, line in enumerate(lines):
            if line.startswith("CPU"):
                df = pd.read_fwf(StringIO('\n'.join(lines[i:i+6])))
                if comment['user']:
                    df['user'] = comment['user']['login']
                else:
                    df['user'] = 'ghost'
                if df.shape == (5, 9) and df.columns.to_list() == expected_cols:
                    dfs.append(df)
    return pd.concat(dfs).reset_index(drop=True)


def munging(df):
    df = df[(df.AVG_WATTS < 50) & (df.AVG_WATTS > 0)]
    df.loc[:, 'BITRATE'] = df['BITRATE'].str.strip('kb/s').astype(int)
    df.loc[:, 'TIME'] = df['TIME'].str.strip('s').astype(float)
    df.loc[:, 'AVG_SPEED'] = df['AVG_SPEED'].apply(lambda x: float(x[:-1]) if x != 'x' else None)
    df = pd.concat([
        df,
        df['CPU'].str.extract("(i\d)-(.*)").rename({0: "branding", 1: "model"}, axis=1)
    ], axis=1)
    df['generation'] = df['model'].str.extract("(\d{4,5})")[0].\
        apply(lambda x: x[:-3] if pd.notna(x) else None).astype("Int64")
    df['fps_per_watt'] = df['AVG_FPS'].astype(float) / df['AVG_WATTS']
    return df


def viz(df):
    sns.set_theme(context='talk', style='whitegrid')
    metrics = ['AVG_FPS', 'AVG_WATTS', 'fps_per_watt']
    fig, ax = plt.subplots(1, len(metrics), figsize=(20, 7))
    for i, metric in enumerate(metrics):
        sns.boxplot(df[df.generation.notna()], x="generation", y=metric, hue="TEST", ax=ax[i], fliersize=0)
        if i == 1:
            sns.move_legend(ax[i], "lower center", bbox_to_anchor=(.5, 1), ncol=4, title=None, frameon=False)
        else:
            ax[i].get_legend().remove()
    fig.savefig("plot.png", dpi=300)


def main():
    commets = get_comments()
    df = extract_results(commets)
    df = munging(df)
    viz(df)


if __name__ == "__main__":
    main()
