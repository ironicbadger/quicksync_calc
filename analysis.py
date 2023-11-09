from io import StringIO
import requests
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt


GIST_ID = "5da9b321acbe6b6b53070437023b844d"


def get_comments():
    comments = []
    page = 1
    while True:
        r = requests.get(f"https://api.github.com/gists/{GIST_ID}/comments", params={"page": page})
        r.raise_for_status()
        r = r.json()
        comments += r
        if len(r) != 30:
            break
        page +=1
    return comments


def extract_results(comments):
    dfs = []
    for comment in comments:
        lines =  comment['body'].splitlines()
        for i, line in enumerate(lines):
            if line.startswith("CPU"):
                df = pd.read_fwf(StringIO('\n'.join(lines[i:i+6])))
                df['user'] =  comment['user']['login']
                if df.shape == (5, 9) and df.columns.to_list() == ['CPU', 'TEST', 'FILE', 'BITRATE', 'TIME', 'AVG_FPS', 'AVG_SPEED',
       'AVG_WATTS', 'user']:
                    dfs.append(df)
    return pd.concat(dfs).reset_index(drop=True)


def munging(df):
    df = df[df.AVG_WATTS < 1000]
    df['BITRATE'] = df['BITRATE'].str.strip('kb/s').astype(int)
    df['TIME'] = df['TIME'].str.strip('s').astype(float)
    df['AVG_SPEED'] = df['AVG_SPEED'].apply(lambda x: float(x[:-1]) if x != 'x' else None)
    df = pd.concat([df,
                    df['CPU'].str.extract("(i\d)-(.*)").rename({0:"branding", 1:"model"}, axis=1)
                    ], axis=1)
    df['generation'] = df['model'].str.extract("(\d{4,5})")[0].apply(lambda x: x[:-3] if pd.notna(x) else None).astype("Int64")
    df['fps_per_watt'] = df['AVG_FPS'] /  df['AVG_WATTS']
    return df


def viz(df):
    sns.set_theme(context='talk', style='whitegrid')
    metrics = ['AVG_FPS', 'AVG_WATTS','fps_per_watt']
    fig, ax = plt.subplots(1, len(metrics), figsize=(20, 5))
    for i, metric in enumerate(metrics):
        sns.boxplot(df[df.generation.notna()], x="generation", y=metric, hue="TEST", ax=ax[i])
        if i==1:
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
