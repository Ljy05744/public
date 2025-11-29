#version 300 es
precision mediump float;

out vec4 FragColor;

uniform float ambientStrength, specularStrength, diffuseStrength, shininess;

in vec3 Normal;//法向量
in vec3 FragPos;//相机观察的片元位置
in vec2 TexCoord;//纹理坐标
in vec4 FragPosLightSpace;//光源观察的片元位置
in float v_Distance; // 顶点到相机的距离（用于雾化计算）

uniform vec3 viewPos;//相机位置
uniform vec4 u_lightPosition; //光源位置
uniform vec3 lightColor;//入射光颜色

uniform sampler2D diffuseTexture;
uniform sampler2D depthTexture;

// 雾化效果相关uniform变量 - 新增
uniform int u_fogEnabled;     // 是否启用雾化
uniform float u_fogDensity;   // 雾密度
uniform float u_fogGradient;  // 雾梯度
uniform vec3 u_fogColor;      // 雾颜色

float shadowCalculation(vec4 fragPosLightSpace, vec3 normal, vec3 lightDir)
{
    // 1. 将光源视角下的片元位置从裁剪空间转换到NDC（[-1,1]）
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    
    // 2. 映射到纹理采样坐标范围[0,1]
    projCoords = projCoords * 0.5 + 0.5;
    
    // 3. 获取ShadowMap中存储的深度（光源视角下最近的深度）
    float closestDepth = texture(depthTexture, projCoords.xy).r;
    
    // 4. 当前片元在光源视角下的深度
    float currentDepth = projCoords.z;
    
    // 5. 计算阴影偏移（解决阴影 acne）
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    
    // 6. 基础阴影判定：当前深度 > 最近深度 + 偏移 → 阴影
    float shadow = currentDepth > closestDepth + bias ? 1.0 : 0.0;
    
    // 7. 边界处理：超出光源视锥范围的部分不计算阴影
    if(projCoords.z > 1.0)
        shadow = 0.0;

    return shadow;
}

void main()
{
    // 采样纹理颜色
    vec3 TextureColor = texture(diffuseTexture, TexCoord).rgb;

    // 计算光照方向
    vec3 norm = normalize(Normal);
    vec3 lightDir;
    if(u_lightPosition.w == 1.0)
        lightDir = normalize(u_lightPosition.xyz - FragPos);
    else 
        lightDir = normalize(u_lightPosition.xyz);
    
    vec3 viewDir = normalize(viewPos - FragPos);

    /* Phong光照计算 */
    // 环境光
    vec3 ambient = ambientStrength * lightColor;
    
    // 漫反射
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = diffuseStrength * diff * lightColor;
    
    // 镜面反射（Phong模型：反射向量）
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
    vec3 specular = specularStrength * spec * lightColor;

    /* 阴影计算 */
    float shadow = shadowCalculation(FragPosLightSpace, norm, lightDir);

    // 基础光照颜色：光照 * 纹理颜色 * 阴影因子（阴影区域减弱光照）
    vec3 result = (ambient + (1.0 - shadow) * (diffuse + specular)) * TextureColor;
    
    // 雾化效果
    if (u_fogEnabled == 1) {
        // 计算雾化因子（指数雾）
        float fogFactor = exp(-pow(v_Distance * u_fogDensity, u_fogGradient));
        fogFactor = clamp(fogFactor, 0.0, 1.0);
        
        // 混合原始颜色和雾颜色
        result = mix(u_fogColor, result, fogFactor);
    }
    
    FragColor = vec4(result, 1.0);
}