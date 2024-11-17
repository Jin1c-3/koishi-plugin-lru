import { Context, Schema, sleep } from "koishi";
import {} from "koishi-plugin-adapter-onebot";

export const name = "lru";

export interface Config {
  relex_time: number;
}

export const Config: Schema<Config> = Schema.object({
  relex_time: Schema.number()
    .role("slider")
    .min(1.5)
    .max(10)
    .step(0.5)
    .default(2.5)
    .description("踢每个人的间隔时间，踢太快可能被封。单位：秒"),
});

export function apply(ctx: Context, { relex_time }: Config) {
  ctx.i18n.define("zh-CN", require("./locales/zh-CN"));
  ctx = ctx.platform("onebot").guild();
  ctx
    .command("lru <threshold:number>", {
      authority: 3,
    })
    .option("dry", "只检测不踢人")
    .option("no-title", "不踢有头衔的群友")
    .action(async ({ session, options }, threshold) => {
      if (!threshold || threshold <= 0) return session.text(".no-threshold");

      let users = await session.onebot.getGroupMemberList(
        session.guildId,
        true
      );
      // 只留下普通成员和除机器人以外的成员
      users = users.filter(
        (user) => user.role === "member" && !ctx.bots[user.user_id]
      );
      if (threshold > users.length) return session.text(".bad-threshold");
      users = users.sort((a, b) => a.last_sent_time - b.last_sent_time);
      const userDict: Record<number, number> = {};
      users.forEach((user, index) => {
        userDict[user.user_id] = index;
      });

      let target = options["no-title"]
        ? users.filter((user) => !user.title).slice(0, threshold)
        : users.slice(0, threshold);

      if (target.length === 0) return session.text(".bad-threshold");

      const last_user = target[target.length - 1];
      const output = [
        session.text(".alert-normal", [
          target.length,
          new Date(last_user.last_sent_time * 1000).toLocaleDateString(),
        ]),
      ];

      if (options["no-title"]) {
        const title_num = userDict[last_user.user_id] - target.length;
        output.splice(1, 0, session.text(".alert-no-title", [title_num]));
      }
      await session.send(output.join("\n"));
      if (options.dry) return;
      for (let index = 0; index < target.length; index++) {
        if (index) await sleep(relex_time * 1000);
        await session.onebot.setGroupKick(
          session.guildId,
          target[index].user_id
        );
      }
      return session.text(".alert-final", [target.length]);
    });
}
