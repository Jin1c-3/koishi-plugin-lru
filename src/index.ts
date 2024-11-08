import { Context, Schema, sleep } from "koishi";
import {} from "koishi-plugin-adapter-onebot";

export const name = "lru";

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context) {
  ctx = ctx.platform("onebot").guild();

  ctx
    .command(
      "lru <threshold:number>",
      "踢出太久没有发言的群友，必要函参要踢的人数",
      {
        authority: 3,
      }
    )
    .option("dry", "只检测不踢人")
    .option("no-title", "不踢有头衔的群友")
    .action(async ({ session, options }, threshold) => {
      if (!threshold) return "请输入要踢的人数。";

      let users = await session.onebot.getGroupMemberList(
        session.guildId,
        true
      );
      if (threshold < 0 || threshold >= users.length) return "参数不合理。";
      users = users.sort((a, b) => a.last_sent_time - b.last_sent_time);
      let title_num = 0;
      if (options["no-title"]) {
        users = users.filter((user) => !user.title);
      }
      if (threshold < 0 || threshold >= users.length) return "参数不合理。";
      let target = [];
      for (let user of users) {
        if (options["no-title"] && user.title) {
          title_num++;
          continue;
        }
        target.push(user);
        if (target.length === threshold) break;
      }
      const last_user = target[target.length - 1];
      await session.send(
        [
          `将要清理群友 ${target.length} 人`,
          options["no-title"] ? `有 ${title_num} 个有头衔的群友逃脱处理` : "",
          `最后一位群友上次发言的时间：\n${new Date(
            last_user.last_sent_time * 1000
          )}`,
        ].join("\n")
      );
      if (options.dry) return;
      const delay = ctx.root.config.delay.broadcast;
      for (let index = 0; index < target.length; index++) {
        if (index && delay) await sleep(delay);
        await session.onebot.setGroupKick(
          session.guildId,
          target[index].user_id
        );
      }
      return `已踢出群友 ${target.length} 人`;
    });
}
